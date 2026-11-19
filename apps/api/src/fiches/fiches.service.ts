import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, StatutAvis, Visibilite } from '@prisma/client';
import { completer, technologie, universFiche, validerValeurs } from '@decapage/machine-kit';
import { Principal } from '../auth/decorators';
import { CatalogueService, imageMachine, nomMachine } from '../catalogue/catalogue.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CreerFicheDto, EvaluerDto, FiltresDto, ModifierFicheDto } from './fiches.dto';

const INCLUDE = {
  user: { select: { id: true, identifiant: true, nom: true, accordPhotosMarketing: true } },
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
  precisions: { include: { groupe: { select: { slug: true, nom: true } } } },
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
      include: { user: { select: { id: true, identifiant: true, nom: true } }, tags: { include: { tag: true } }, precisions: true },
    });
    if (!f) return {};
    return {
      fiche: {
        id: f.id, titre: f.titre, commentaire: f.commentaire, tags: f.tags.map((t) => t.tag.nom), precisions: f.precisions.map((p) => p.texte),
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
          univers: f.univers,
          visibilite: f.visibilite,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
          estAuteur: f.userId === moi.id,
          auteur: f.user.nom || f.user.identifiant,
          masquee: f.masquee,
          // Réservé aux admins : savoir précisément qui a fait l'enregistrement.
          ...(moi.role === Role.ADMIN ? { auteurAdmin: { id: f.user.id, identifiant: f.user.identifiant, nom: f.user.nom, accordPhotosMarketing: f.user.accordPhotosMarketing } } : {}),
          machine: {
            userMachineId: f.userMachine?.id ?? null,
            surnom: f.userMachine?.surnom ?? null,
            varianteId: f.versionInterface.varianteId,
            modeleId: f.versionInterface.variante.modeleId,
            nom: nomMachine(f.versionInterface.variante),
            varianteNom: f.versionInterface.variante.nom,
            imageUrl: imageMachine(f.versionInterface.variante),
          },
          version: { id: f.versionInterface.id, numero: f.versionInterface.numero },
          tags: f.tags.map((t) => ({ id: t.tag.id, slug: t.tag.slug, nom: t.tag.nom, groupe: t.tag.groupe.slug })),
          // précision libre par groupe (ex. Matériau → « 316L »)
          precisions: f.precisions.map((p) => ({ groupeId: p.groupeId, groupe: p.groupe.slug, texte: p.texte })),
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
      ...(f.univers ? { univers: f.univers } : {}),
      ...(f.userMachineId ? { userMachineId: f.userMachineId } : {}),
      ...(f.varianteId
        ? { versionInterface: { varianteId: f.varianteId } }
        : f.modeleId
          ? { versionInterface: { variante: { modeleId: f.modeleId } } }
          : {}),
      // recherche : titre, commentaire, précisions (« 316L ») et noms des familles (« Aluminium »)
      ...(f.q
        ? {
            OR: [
              { titre: { contains: f.q, mode: 'insensitive' } },
              { commentaire: { contains: f.q, mode: 'insensitive' } },
              { precisions: { some: { texte: { contains: f.q, mode: 'insensitive' } } } },
              { tags: { some: { tag: { nom: { contains: f.q, mode: 'insensitive' } } } } },
            ],
          }
        : {}),
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

  /**
   * Communauté. Avec une recherche (ex. « 6082 ») : d'abord les fiches qui correspondent, puis (page 1)
   * « Plus de réglages » de la même famille (ex. Aluminium) pour ne jamais tomber sur une liste vide.
   */
  async communaute(moi: Principal, f: FiltresDto) {
    const base: Prisma.FicheWhereInput = { visibilite: Visibilite.PARTAGEE, masquee: false };
    const r = await this.page({ ...this.where(f), ...base }, { tri: 'note', ...f }, moi);
    if (!f.q?.trim() || (f.page ?? 1) > 1) return r;
    // familles des précisions trouvées (même groupe que la précision)
    const precisions = await this.prisma.fichePrecision.findMany({
      where: { texte: { contains: f.q.trim(), mode: 'insensitive' }, fiche: base },
      select: { groupeId: true, fiche: { select: { tags: { select: { tag: { select: { id: true, nom: true, slug: true, groupeId: true } } } } } } },
      take: 200,
    });
    const familles = new Map<string, { id: string; nom: string }>();
    for (const p of precisions)
      for (const t of p.fiche.tags) if (t.tag.groupeId === p.groupeId && t.tag.slug !== 'autre') familles.set(t.tag.id, { id: t.tag.id, nom: t.tag.nom });
    if (!familles.size) return { ...r, apparentees: null };
    const sansQ = { ...f, q: undefined };
    const proches = await this.prisma.fiche.findMany({
      where: { ...this.where(sansQ), ...base, NOT: { id: { in: r.fiches.map((x) => x.id) } }, tags: { some: { tagId: { in: [...familles.keys()] } } } },
      include: INCLUDE,
      orderBy: [{ noteMoyenne: { sort: 'desc', nulls: 'last' } }, { nbNotes: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });
    return { ...r, apparentees: proches.length ? { familles: [...familles.values()], fiches: await this.vues(proches, moi) } : null };
  }

  // ---------- top réglages ----------

  /**
   * Les meilleurs réglages par tag (matériau, à enlever, application) : 3 par tag,
   * triés par note moyenne puis nombre de notes. Fiches partagées, non masquées, déjà notées.
   */
  async top(moi: Principal, f: { varianteId?: string; univers?: string; parTag?: number }) {
    const parTag = f.parTag ?? 3;
    const candidates = await this.prisma.fiche.findMany({
      where: {
        visibilite: Visibilite.PARTAGEE, masquee: false, noteMoyenne: { not: null },
        ...(f.varianteId ? { versionInterface: { varianteId: f.varianteId } } : {}),
        ...(f.univers ? { univers: f.univers } : {}),
      },
      include: INCLUDE,
      orderBy: [{ noteMoyenne: 'desc' }, { nbNotes: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
    const groupes = await this.prisma.groupeTag.findMany({
      where: f.univers ? { OR: [{ univers: { isEmpty: true } }, { univers: { has: f.univers } }] } : {},
      orderBy: { ordre: 'asc' },
    });
    const parTagId = new Map<string, { tag: { id: string; nom: string }; groupe: string; fiches: FicheComplete[] }>();
    for (const fi of candidates)
      for (const t of fi.tags) {
        const e = parTagId.get(t.tag.id) ?? { tag: { id: t.tag.id, nom: t.tag.nom }, groupe: t.tag.groupe.slug, fiches: [] };
        if (e.fiches.length < parTag) e.fiches.push(fi);
        parTagId.set(t.tag.id, e);
      }
    const utiles = [...new Map([...parTagId.values()].flatMap((e) => e.fiches).map((x) => [x.id, x])).values()];
    const vues = new Map((await this.vues(utiles, moi)).map((v) => [v.id, v]));
    return groupes
      .map((g) => ({
        slug: g.slug,
        nom: g.nom,
        tags: [...parTagId.values()]
          .filter((e) => e.groupe === g.slug)
          .sort((a, b) => (b.fiches[0].noteMoyenne ?? 0) - (a.fiches[0].noteMoyenne ?? 0) || a.tag.nom.localeCompare(b.tag.nom))
          .map((e) => ({ ...e.tag, fiches: e.fiches.map((x) => vues.get(x.id)!) })),
      }))
      .filter((g) => g.tags.length);
  }

  // ---------- demande d'aide (bouton masqué tant que le paramètre aideSupport est désactivé) ----------

  async demanderAide(id: string, moi: Principal, message: string) {
    const f = await this.charger(id, moi);
    const d = await this.prisma.demandeAide.create({ data: { ficheId: id, userId: moi.id, message: message.trim() } });
    const u = await this.prisma.user.findUnique({ where: { id: moi.id }, select: { id: true, identifiant: true, nom: true } });
    void this.chargeFiche(id).then((c) =>
      this.webhooks.emettre('aide.demandee', {
        ...c,
        demande: { id: d.id, message: d.message, demandeur: u, creeLe: d.createdAt },
        valeurs: f.valeurs,
        photos: f.photos.map((p) => ({ id: p.id, type: p.type, url: this.lien(`/api/photos/${p.id}`) })),
      }),
    );
    return { ok: true, id: d.id };
  }

  async demandesAide(traitee?: boolean) {
    return this.prisma.demandeAide.findMany({
      where: traitee === undefined ? {} : { traitee },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { id: true, identifiant: true, nom: true } }, fiche: { select: { id: true, titre: true } } },
    });
  }

  async traiterAide(id: string, traitee: boolean) {
    await this.prisma.demandeAide.update({ where: { id }, data: { traitee } });
    return { ok: true };
  }

  // ---------- administration ----------

  /** Toutes les fiches (masquées comprises), filtrables par auteur et par état. */
  adminFiches(moi: Principal, f: FiltresDto & { userId?: string; masquee?: string; photosUtilisables?: string }) {
    return this.page(
      {
        ...this.where(f),
        ...(f.userId ? { userId: f.userId } : {}),
        ...(f.masquee === 'oui' ? { masquee: true } : f.masquee === 'non' ? { masquee: false } : {}),
        // Photos utilisables = l'auteur a donné son accord (dans son compte) et la fiche a des photos.
        ...(f.photosUtilisables === 'oui' ? { user: { accordPhotosMarketing: true }, photos: { some: {} } } : {}),
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

  /** Tags existants et validés ; un seul par groupe à choix unique (Matériau, Application). */
  private async verifierTags(tagIds: string[] = []) {
    const ids = [...new Set(tagIds)];
    if (!ids.length) return ids;
    const tags = await this.prisma.tag.findMany({ where: { id: { in: ids }, valide: true }, include: { groupe: true } });
    if (tags.length !== ids.length) throw new BadRequestException('Tag inconnu');
    for (const g of new Set(tags.filter((t) => t.groupe.choixUnique).map((t) => t.groupe)))
      if (tags.filter((t) => t.groupeId === g.id).length > 1) throw new BadRequestException(`${g.nom} : un seul choix`);
    return ids;
  }

  /** Précisions libres : { groupeId: texte } → lignes à créer (texte vide = pas de précision). */
  private async verifierPrecisions(p?: Record<string, string>) {
    if (!p) return undefined;
    const l = Object.entries(p).map(([groupeId, texte]) => ({ groupeId, texte: String(texte ?? '').trim().replace(/\s+/g, ' ') })).filter((x) => x.texte);
    if (l.some((x) => x.texte.length > 80)) throw new BadRequestException('Précision : 80 caractères au plus');
    if (l.length && (await this.prisma.groupeTag.count({ where: { id: { in: l.map((x) => x.groupeId) } } })) !== l.length) throw new BadRequestException('Groupe inconnu');
    return l;
  }

  /** Valeurs validées et métier de la fiche (décapage, soudure…). */
  private async valider(versionId: string, saisie: Record<string, unknown>) {
    const cfg = await this.catalogue.config(versionId);
    const r = validerValeurs(cfg, saisie);
    if (!r.ok) throw new BadRequestException({ message: 'Réglages invalides', erreurs: r.erreurs });
    return { valeurs: r.valeurs as Prisma.InputJsonValue, univers: universFiche(cfg, r.valeurs) };
  }

  async creer(moi: Principal, dto: CreerFicheDto) {
    const um = await this.prisma.userMachine.findFirst({ where: { id: dto.userMachineId, userId: moi.id } });
    if (!um) throw new NotFoundException('Machine introuvable');
    if (dto.parentId) await this.charger(dto.parentId, moi);
    const version = await this.catalogue.derniereVersion(um.varianteId);
    const { valeurs, univers } = await this.valider(version.id, dto.valeurs);
    const tagIds = await this.verifierTags(dto.tagIds);
    const precisions = (await this.verifierPrecisions(dto.precisions)) ?? [];

    const f = await this.prisma.fiche.create({
      data: {
        userId: moi.id,
        userMachineId: um.id,
        versionInterfaceId: version.id,
        titre: dto.titre.trim(),
        commentaire: dto.commentaire?.trim() || null,
        valeurs,
        univers,
        visibilite: dto.visibilite ?? Visibilite.PARTAGEE, // mise en commun par défaut
        parentId: dto.parentId ?? null,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
        precisions: { create: precisions },
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
    if (dto.valeurs) Object.assign(data, await this.valider(f.versionInterfaceId, dto.valeurs));
    if (dto.tagIds) {
      const ids = await this.verifierTags(dto.tagIds);
      data.tags = { deleteMany: {}, create: ids.map((tagId) => ({ tagId })) };
    }
    const precisions = await this.verifierPrecisions(dto.precisions);
    if (precisions) data.precisions = { deleteMany: {}, create: precisions };
    await this.prisma.fiche.update({ where: { id }, data });
    if (dto.titre !== undefined || dto.commentaire !== undefined || dto.tagIds || precisions)
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

