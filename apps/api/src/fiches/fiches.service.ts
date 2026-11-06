import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, StatutAvis, Visibilite } from '@prisma/client';
import { completer, technologie, validerValeurs } from '@decapage/machine-kit';
import { Principal } from '../auth/decorators';
import { CatalogueService, nomMachine } from '../catalogue/catalogue.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
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
  constructor(private prisma: PrismaService, private catalogue: CatalogueService, private webhooks: WebhooksService) {}

  /** Qui modère : un admin connecté, ou un service externe (IA) via clé API. */
  private origine(moi: Principal) {
    return moi.type === 'cleApi' ? 'auto' : 'admin';
  }

  private lien(chemin: string) {
    return (process.env.PUBLIC_URL ?? '').replace(/\/$/, '') + chemin;
  }

  /** Contenu envoyé aux webhooks pour une fiche (texte à modérer + où agir). */
  private async chargeFiche(id: string) {
    const f = await this.prisma.fiche.findUnique({
      where: { id },
      include: { user: { select: { id: true, identifiant: true, nom: true } }, tags: { include: { tag: true } } },
    });
    if (!f) return {};
    return {
      fiche: {
        id: f.id, titre: f.titre, commentaire: f.commentaire, tags: f.tags.map((t) => t.tag.nom),
        auteur: f.user, creeLe: f.createdAt, lien: this.lien(`/fiches/${f.id}`),
      },
      moderation: { methode: 'PATCH', url: this.lien(`/api/admin/fiches/${f.id}`), exemple: { masquee: true, raison: '…' } },
    };
  }

  // ---------- lecture ----------

  peutVoir(f: { userId: string; visibilite: Visibilite; masquee: boolean }, moi: Principal) {
    if (f.userId === moi.id || moi.role === Role.ADMIN) return true;
    return f.visibilite === Visibilite.PARTAGEE && !f.masquee;
  }

  async charger(id: string, moi: Principal) {
    const f = await this.prisma.fiche.findUnique({ where: { id }, include: INCLUDE });
    if (!f || !this.peutVoir(f, moi)) throw new NotFoundException('Fiche introuvable');
    return f;
  }

  async detail(id: string, moi: Principal) {
    const f = await this.charger(id, moi);
    const [vue] = await this.vues([f], moi);
    const admin = moi.role === Role.ADMIN;
    const evaluations = await this.prisma.evaluation.findMany({
      where: { ficheId: id, ...(admin ? {} : { OR: [{ statut: StatutAvis.VISIBLE }, { userId: moi.id }] }) },
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { id: true, identifiant: true, nom: true } } },
    });
    return {
      ...vue,
      evaluations: evaluations.map((e) => ({
        id: e.id,
        estMoi: e.userId === moi.id,
        statut: e.statut,
        ...(admin || e.userId === moi.id ? { moderationRaison: e.moderationRaison } : {}),
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
          masquee: f.masquee,
          // Réservé aux admins : savoir précisément qui a fait l'enregistrement.
          ...(moi.role === Role.ADMIN ? { auteurAdmin: { id: f.user.id, identifiant: f.user.identifiant, nom: f.user.nom } } : {}),
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
      ...(f.noteMin ? { noteMoyenne: { gte: f.noteMin } } : {}),
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
    return this.page({ ...this.where(f), visibilite: Visibilite.PARTAGEE, masquee: false }, { tri: 'note', ...f }, moi);
  }

  // ---------- administration ----------

  /** Toutes les fiches (masquées comprises), filtrables par auteur et par état. */
  adminFiches(moi: Principal, f: FiltresDto & { userId?: string; masquee?: string }) {
    return this.page(
      {
        ...this.where(f),
        ...(f.userId ? { userId: f.userId } : {}),
        ...(f.masquee === 'oui' ? { masquee: true } : f.masquee === 'non' ? { masquee: false } : {}),
      },
      { tri: 'recent', ...f },
      moi,
    );
  }

  async masquer(id: string, masquee: boolean, moi: Principal, raison?: string) {
    const f = await this.prisma.fiche.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Fiche introuvable');
    await this.prisma.fiche.update({
      where: { id },
      data: { masquee, masqueeLe: masquee ? new Date() : null, moderationRaison: masquee ? raison?.trim() || null : null, moderePar: this.origine(moi) },
    });
    return this.detail(id, moi);
  }

  /** Tous les avis (texte ou note), pour la modération. */
  async adminAvis(f: { statut?: StatutAvis; q?: string; avecTexte?: boolean; page?: number; parPage?: number }) {
    const parPage = f.parPage ?? 30;
    const page = f.page ?? 1;
    const where: Prisma.EvaluationWhereInput = {
      ...(f.statut ? { statut: f.statut } : {}),
      ...(f.avecTexte ? { avis: { not: null } } : {}),
      ...(f.q ? { avis: { contains: f.q, mode: 'insensitive' } } : {}),
    };
    const [total, avis] = await Promise.all([
      this.prisma.evaluation.count({ where }),
      this.prisma.evaluation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * parPage,
        take: parPage,
        include: { user: { select: { id: true, identifiant: true, nom: true } }, fiche: { select: { id: true, titre: true, userId: true } } },
      }),
    ]);
    return {
      total, page, parPage,
      avis: avis.map((e) => ({
        id: e.id, note: e.note, avis: e.avis, statut: e.statut, moderationRaison: e.moderationRaison, moderePar: e.moderePar,
        date: e.updatedAt, auteur: e.user, fiche: { id: e.fiche.id, titre: e.fiche.titre }, estAuteurFiche: e.userId === e.fiche.userId,
      })),
    };
  }

  /** Masquer / réafficher / valider un avis (admin ou service externe via clé API). */
  async modererAvis(id: string, statut: StatutAvis, moi: Principal, raison?: string) {
    const e = await this.prisma.evaluation.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Avis introuvable');
    await this.prisma.$transaction(async (tx) => {
      await tx.evaluation.update({
        where: { id },
        data: { statut, moderationRaison: statut === StatutAvis.VISIBLE ? null : raison?.trim() || null, moderePar: this.origine(moi), modereLe: new Date() },
      });
      await this.recalculerNote(tx, e.ficheId);
    });
    return { ok: true, id, statut };
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
        visibilite: dto.visibilite ?? Visibilite.PARTAGEE, // mise en commun par défaut
        parentId: dto.parentId ?? null,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
    if (dto.note) await this.evaluer(f.id, moi, { note: dto.note }, { silencieux: true });
    void this.chargeFiche(f.id).then((c) => this.webhooks.emettre('fiche.creee', c));
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
    if (dto.titre !== undefined || dto.commentaire !== undefined || dto.tagIds)
      void this.chargeFiche(id).then((c) => this.webhooks.emettre('fiche.modifiee', c));
    return this.detail(id, moi);
  }

  async supprimer(id: string, moi: Principal) {
    await this.proprietaire(id, moi);
    await this.prisma.fiche.delete({ where: { id } });
    return { ok: true };
  }

  async evaluer(id: string, moi: Principal, dto: EvaluerDto, opts: { silencieux?: boolean } = {}) {
    const f = await this.charger(id, moi);
    const avant = await this.prisma.evaluation.findUnique({ where: { ficheId_userId: { ficheId: id, userId: moi.id } } });
    const texte = dto.avis?.trim() || null;
    // Un avis masqué par la modération le reste s'il est modifié (l'admin peut le réafficher).
    // Avec MODERATION_PREALABLE_AVIS=true, un avis avec texte attend d'être validé (par l'admin ou une IA).
    const prealable = process.env.MODERATION_PREALABLE_AVIS === 'true' && !!texte && f.userId !== moi.id;
    const statut =
      avant?.statut === StatutAvis.MASQUE ? StatutAvis.MASQUE : prealable && texte !== avant?.avis ? StatutAvis.EN_ATTENTE : avant?.statut ?? StatutAvis.VISIBLE;
    const e = await this.prisma.$transaction(async (tx) => {
      const e = await tx.evaluation.upsert({
        where: { ficheId_userId: { ficheId: id, userId: moi.id } },
        update: { note: dto.note, avis: texte, statut },
        create: { ficheId: id, userId: moi.id, note: dto.note, avis: texte, statut },
      });
      await this.recalculerNote(tx, id);
      return e;
    });
    if (!opts.silencieux)
      void this.webhooks.emettre(avant ? 'avis.modifie' : 'avis.publie', {
        avis: { id: e.id, note: e.note, texte: e.avis, statut: e.statut, auteur: { id: moi.id }, estAuteurFiche: f.userId === moi.id },
        fiche: { id: f.id, titre: f.titre, lien: this.lien(`/fiches/${f.id}`) },
        moderation: { methode: 'PATCH', url: this.lien(`/api/admin/avis/${e.id}`), exemple: { statut: 'MASQUE', raison: '…' } },
      });
    return { ok: true, statut: e.statut };
  }

  async retirerEvaluation(id: string, moi: Principal) {
    await this.prisma.$transaction(async (tx) => {
      await tx.evaluation.deleteMany({ where: { ficheId: id, userId: moi.id } });
      await this.recalculerNote(tx, id);
    });
    return { ok: true };
  }

  private async recalculerNote(tx: Prisma.TransactionClient, ficheId: string) {
    // Seuls les avis visibles comptent dans la moyenne.
    const a = await tx.evaluation.aggregate({ where: { ficheId, statut: StatutAvis.VISIBLE }, _avg: { note: true }, _count: true });
    await tx.fiche.update({
      where: { id: ficheId },
      data: { noteMoyenne: a._avg.note === null ? null : +a._avg.note.toFixed(2), nbNotes: a._count },
    });
  }
}

