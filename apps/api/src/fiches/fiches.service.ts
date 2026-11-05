import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, Visibilite } from '@prisma/client';
import { completer, technologie, validerValeurs } from '@decapage/machine-kit';
import { Principal } from '../auth/decorators';
import { CatalogueService, nomMachine } from '../catalogue/catalogue.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreerFicheDto, EvaluerDto, FiltresDto, ModifierFicheDto } from './fiches.dto';

const INCLUDE = {
  user: { select: { id: true, identifiant: true, nom: true } },
  userMachine: { select: { id: true, surnom: true } },
  versionInterface: {
    select: {
      id: true,
      numero: true,
      varianteId: true,
      variante: { include: { modele: { include: { fabricant: true } } } },
    },
  },
  tags: { include: { tag: { include: { groupe: { select: { slug: true, nom: true } } } } } },
  photos: { orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }], select: { id: true, type: true, ordre: true } },
  parent: { select: { id: true, titre: true } },
  _count: { select: { copies: true } },
} satisfies Prisma.FicheInclude;

type FicheComplete = Prisma.FicheGetPayload<{ include: typeof INCLUDE }>;

@Injectable()
export class FichesService {
  constructor(private prisma: PrismaService, private catalogue: CatalogueService) {}

  // ---------- lecture ----------

  peutVoir(f: { userId: string; visibilite: Visibilite }, moi: Principal) {
    return f.userId === moi.id || f.visibilite === Visibilite.PARTAGEE || moi.role === Role.ADMIN;
  }

  async charger(id: string, moi: Principal) {
    const f = await this.prisma.fiche.findUnique({ where: { id }, include: INCLUDE });
    if (!f || !this.peutVoir(f, moi)) throw new NotFoundException('Fiche introuvable');
    return f;
  }

  async detail(id: string, moi: Principal) {
    const f = await this.charger(id, moi);
    const [vue] = await this.vues([f], moi);
    const evaluations = await this.prisma.evaluation.findMany({
      where: { ficheId: id },
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { id: true, identifiant: true, nom: true } } },
    });
    return {
      ...vue,
      evaluations: evaluations.map((e) => ({
        note: e.note,
        avis: e.avis,
        date: e.updatedAt,
        auteur: e.user.nom || e.user.identifiant,
        estAuteurFiche: e.userId === f.userId,
      })),
    };
  }

  private async vues(fiches: FicheComplete[], moi: Principal) {
    const mes = await this.prisma.evaluation.findMany({
      where: { userId: moi.id, ficheId: { in: fiches.map((f) => f.id) } },
      select: { ficheId: true, note: true },
    });
    const maNote = new Map(mes.map((e) => [e.ficheId, e.note]));
    return Promise.all(
      fiches.map(async (f) => {
        const cfg = await this.catalogue.config(f.versionInterfaceId);
        const valeurs = f.valeurs as Record<string, never>;
        return {
          id: f.id,
          titre: f.titre,
          commentaire: f.commentaire,
          valeurs,
          visibilite: f.visibilite,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
          estAuteur: f.userId === moi.id,
          auteur: f.user.nom || f.user.identifiant,
          machine: {
            userMachineId: f.userMachine?.id ?? null,
            surnom: f.userMachine?.surnom ?? null,
            varianteId: f.versionInterface.varianteId,
            modeleId: f.versionInterface.variante.modeleId,
            nom: nomMachine(f.versionInterface.variante),
          },
          version: { id: f.versionInterface.id, numero: f.versionInterface.numero },
          tags: f.tags.map((t) => ({ id: t.tag.id, slug: t.tag.slug, nom: t.tag.nom, groupe: t.tag.groupe.slug })),
          photos: f.photos,
          note: { moyenne: f.noteMoyenne, nombre: f.nbNotes, maNote: maNote.get(f.id) ?? null },
          parent: f.parent,
          nbCopies: f._count.copies,
          // Recalculés à chaque lecture : corriger une constante met à jour toutes les fiches.
          indicateurs: technologie(cfg.technologie)?.indicateurs(cfg, completer(cfg, valeurs)) ?? [],
        };
      }),
    );
  }

  private where(f: FiltresDto): Prisma.FicheWhereInput {
    const tags = (f.tags ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return {
      ...(f.userMachineId ? { userMachineId: f.userMachineId } : {}),
      ...(f.varianteId
        ? { versionInterface: { varianteId: f.varianteId } }
        : f.modeleId
          ? { versionInterface: { variante: { modeleId: f.modeleId } } }
          : {}),
      ...(f.q ? { OR: [{ titre: { contains: f.q, mode: 'insensitive' } }, { commentaire: { contains: f.q, mode: 'insensitive' } }] } : {}),
      ...(tags.length ? { AND: tags.map((tagId) => ({ tags: { some: { tagId } } })) } : {}),
    };
  }

  private async page(where: Prisma.FicheWhereInput, f: FiltresDto, moi: Principal) {
    const parPage = f.parPage ?? 20;
    const page = f.page ?? 1;
    const orderBy: Prisma.FicheOrderByWithRelationInput[] =
      f.tri === 'note'
        ? [{ noteMoyenne: { sort: 'desc', nulls: 'last' } }, { nbNotes: 'desc' }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }];
    const [total, fiches] = await Promise.all([
      this.prisma.fiche.count({ where }),
      this.prisma.fiche.findMany({ where, include: INCLUDE, orderBy, skip: (page - 1) * parPage, take: parPage }),
    ]);
    return { total, page, parPage, fiches: await this.vues(fiches, moi) };
  }

  mesFiches(moi: Principal, f: FiltresDto) {
    return this.page({ ...this.where(f), userId: moi.id }, { tri: 'recent', ...f }, moi);
  }

  communaute(moi: Principal, f: FiltresDto) {
    return this.page({ ...this.where(f), visibilite: Visibilite.PARTAGEE }, { tri: 'note', ...f }, moi);
  }

  // ---------- écriture ----------

  private async verifierTags(tagIds: string[] = []) {
    const ids = [...new Set(tagIds)];
    if (!ids.length) return ids;
    const n = await this.prisma.tag.count({ where: { id: { in: ids } } });
    if (n !== ids.length) throw new BadRequestException('Tag inconnu');
    return ids;
  }

  private async valider(versionId: string, saisie: Record<string, unknown>) {
    const cfg = await this.catalogue.config(versionId);
    const r = validerValeurs(cfg, saisie);
    if (!r.ok) throw new BadRequestException({ message: 'Réglages invalides', erreurs: r.erreurs });
    return r.valeurs as Prisma.InputJsonValue;
  }

  async creer(moi: Principal, dto: CreerFicheDto) {
    const um = await this.prisma.userMachine.findFirst({ where: { id: dto.userMachineId, userId: moi.id } });
    if (!um) throw new NotFoundException('Machine introuvable');
    if (dto.parentId) await this.charger(dto.parentId, moi);
    const version = await this.catalogue.derniereVersion(um.varianteId);
    const valeurs = await this.valider(version.id, dto.valeurs);
    const tagIds = await this.verifierTags(dto.tagIds);

    const f = await this.prisma.fiche.create({
      data: {
        userId: moi.id,
        userMachineId: um.id,
        versionInterfaceId: version.id,
        titre: dto.titre.trim(),
        commentaire: dto.commentaire?.trim() || null,
        valeurs,
        visibilite: dto.visibilite ?? Visibilite.PRIVEE,
        parentId: dto.parentId ?? null,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
    if (dto.note) await this.evaluer(f.id, moi, { note: dto.note });
    return this.detail(f.id, moi);
  }

  private async proprietaire(id: string, moi: Principal) {
    const f = await this.prisma.fiche.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Fiche introuvable');
    if (f.userId !== moi.id && moi.role !== Role.ADMIN) throw new ForbiddenException();
    return f;
  }

  async modifier(id: string, moi: Principal, dto: ModifierFicheDto) {
    const f = await this.proprietaire(id, moi);
    const data: Prisma.FicheUpdateInput = {};
    if (dto.titre !== undefined) data.titre = dto.titre.trim();
    if (dto.commentaire !== undefined) data.commentaire = dto.commentaire.trim() || null;
    if (dto.visibilite) data.visibilite = dto.visibilite;
    // Les valeurs restent validées contre la version d'origine de la fiche.
    if (dto.valeurs) data.valeurs = await this.valider(f.versionInterfaceId, dto.valeurs);
    if (dto.tagIds) {
      const ids = await this.verifierTags(dto.tagIds);
      data.tags = { deleteMany: {}, create: ids.map((tagId) => ({ tagId })) };
    }
    await this.prisma.fiche.update({ where: { id }, data });
    return this.detail(id, moi);
  }

  async supprimer(id: string, moi: Principal) {
    await this.proprietaire(id, moi);
    await this.prisma.fiche.delete({ where: { id } });
    return { ok: true };
  }

  async evaluer(id: string, moi: Principal, dto: EvaluerDto) {
    await this.charger(id, moi);
    await this.prisma.$transaction(async (tx) => {
      await tx.evaluation.upsert({
        where: { ficheId_userId: { ficheId: id, userId: moi.id } },
        update: { note: dto.note, avis: dto.avis?.trim() || null },
        create: { ficheId: id, userId: moi.id, note: dto.note, avis: dto.avis?.trim() || null },
      });
      await this.recalculerNote(tx, id);
    });
    return { ok: true };
  }

  async retirerEvaluation(id: string, moi: Principal) {
    await this.prisma.$transaction(async (tx) => {
      await tx.evaluation.deleteMany({ where: { ficheId: id, userId: moi.id } });
      await this.recalculerNote(tx, id);
    });
    return { ok: true };
  }

  private async recalculerNote(tx: Prisma.TransactionClient, ficheId: string) {
    const a = await tx.evaluation.aggregate({ where: { ficheId }, _avg: { note: true }, _count: true });
    await tx.fiche.update({
      where: { id: ficheId },
      data: { noteMoyenne: a._avg.note === null ? null : +a._avg.note.toFixed(2), nbNotes: a._count },
    });
  }
}

