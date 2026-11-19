import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Lecteur, nettoyerListe, verifierEspace, visible } from '../procedures/visibilite';
import { formatImage, StockageService } from '../stockage/stockage.service';
import { Bloc, nettoyerBlocs } from './blocs';

type CoursComplet = Prisma.CoursAcademieGetPayload<{ include: { lecons: { select: { id: true; titre: true; ordre: true; blocs: true } } } }>;

/**
 * Académie : parcours (plusieurs leçons, progression) et pages (un contenu seul : simulateur, fiche…).
 * Visibles par tous les clients de l'espace, ou ciblés « Pour qui ? » (machines, catégories) : les autres ne les voient pas.
 * Leçons en blocs, simulateurs HTML réutilisables.
 */
@Injectable()
export class AcademieService {
  constructor(private prisma: PrismaService, private stockage: StockageService) {}

  // ---------- lecture (clients et admin) ----------

  /** « Réservé à … » : noms des modèles et catégories ciblés. */
  private async pourQui(c: { cibleModeles: string[]; cibleCategories: string[] }) {
    const modeles = c.cibleModeles.length
      ? await this.prisma.modele.findMany({ where: { id: { in: c.cibleModeles } }, select: { nom: true, fabricant: { select: { nom: true } } } })
      : [];
    return [...modeles.map((m) => `${m.fabricant.nom} ${m.nom}`), ...c.cibleCategories];
  }

  /** Vignette du cours : couverture envoyée, sinon celle de la première vidéo. */
  private vignette(c: CoursComplet) {
    if (c.couvertureCle) return { couverture: `/api/academie/cours/${c.id}/couverture?v=${c.updatedAt.getTime()}` };
    for (const l of c.lecons) {
      const v = (l.blocs as Bloc[]).find((b) => b.type === 'vimeo' && b.vignette);
      if (v) return { vignette: v.vignette as string };
    }
    return {};
  }

  /** Hors cible (« Pour qui ? ») : le client ne voit pas le contenu (l'admin voit tout). */
  private horsCible(c: { espace: string; etiquettes: string[]; cibleCategories: string[]; cibleModeles: string[] }, qui: Lecteur) {
    return !!qui && !visible(c, qui.espace, qui);
  }

  /** Contenus de l'espace pour ce client : publiés et pour ses machines (tout pour l'admin), progression et leçon où reprendre. */
  async lister(espace: string, qui: Lecteur, userId: string) {
    const l = await this.prisma.coursAcademie.findMany({
      where: { espace, ...(qui ? { publie: true } : {}) },
      include: { lecons: { orderBy: { ordre: 'asc' }, select: { id: true, titre: true, ordre: true, blocs: true } } },
      orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }],
    });
    const faites = new Set(
      (await this.prisma.progressionAcademie.findMany({ where: { userId, lecon: { coursId: { in: l.map((c) => c.id) } } }, select: { leconId: true } })).map((p) => p.leconId),
    );
    return Promise.all(
      l.filter((c) => !this.horsCible(c, qui)).map(async (c) => ({
        id: c.id, titre: c.titre, description: c.description, publie: c.publie, espace: c.espace, type: c.type,
        ...this.vignette(c),
        nbLecons: c.lecons.length,
        cibleModeles: c.cibleModeles, cibleCategories: c.cibleCategories,
        pourQui: c.cibleModeles.length || c.cibleCategories.length ? await this.pourQui(c) : [],
        faites: c.lecons.filter((x) => faites.has(x.id)).length,
        reprendre: (c.lecons.find((x) => !faites.has(x.id)) ?? c.lecons[0])?.id ?? null,
      })),
    );
  }

  private async coursVisible(id: string, qui: Lecteur) {
    const c = await this.prisma.coursAcademie.findUnique({
      where: { id },
      include: { lecons: { orderBy: { ordre: 'asc' }, select: { id: true, titre: true, ordre: true, blocs: true } } },
    });
    if (!c || (qui && (!c.publie || c.espace !== qui.espace))) throw new NotFoundException('Cours introuvable');
    if (this.horsCible(c, qui)) throw new ForbiddenException({ message: 'Contenu réservé aux propriétaires de la machine', code: 'HORS_CIBLE' });
    return c;
  }

  /** Sommaire d'un cours (leçons, faites ou non). */
  async cours(id: string, qui: Lecteur, userId: string) {
    const c = await this.coursVisible(id, qui);
    const faites = new Set((await this.prisma.progressionAcademie.findMany({ where: { userId, lecon: { coursId: id } }, select: { leconId: true } })).map((p) => p.leconId));
    return {
      id: c.id, titre: c.titre, description: c.description, publie: c.publie, espace: c.espace, type: c.type, ...this.vignette(c),
      cibleCategories: c.cibleCategories, cibleModeles: c.cibleModeles,
      lecons: c.lecons.map((l) => ({ id: l.id, titre: l.titre, faite: faites.has(l.id) })),
    };
  }

  /** Une leçon avec ses blocs (simulateurs : nom ; fichiers : adresse). */
  async lecon(id: string, qui: Lecteur, userId: string) {
    const l = await this.prisma.leconAcademie.findUnique({ where: { id }, select: { id: true, coursId: true, titre: true, blocs: true } });
    if (!l) throw new NotFoundException('Leçon introuvable');
    const c = await this.coursVisible(l.coursId, qui);
    const blocs = l.blocs as Bloc[];
    const simIds = blocs.filter((b) => b.type === 'simulateur').map((b) => b.simulateurId as string);
    const sims = simIds.length ? await this.prisma.simulateurAcademie.findMany({ where: { id: { in: simIds } }, select: { id: true, nom: true } }) : [];
    const i = c.lecons.findIndex((x) => x.id === id);
    const faite = !!(await this.prisma.progressionAcademie.findUnique({ where: { userId_leconId: { userId, leconId: id } } }));
    return {
      id: l.id, titre: l.titre, faite,
      cours: { id: c.id, titre: c.titre, nbLecons: c.lecons.length, rang: i + 1 },
      precedente: c.lecons[i - 1]?.id ?? null,
      suivante: c.lecons[i + 1]?.id ?? null,
      blocs: blocs.map((b) =>
        b.type === 'simulateur' ? { ...b, nom: sims.find((s) => s.id === b.simulateurId)?.nom ?? null }
        : (b.type === 'image' || b.type === 'fichier') && b.fichierId ? { ...b, chemin: `/academie/fichiers/${b.fichierId}` }
        : b,
      ),
    };
  }

  async terminer(leconId: string, qui: Lecteur, userId: string, terminee: boolean) {
    const l = await this.prisma.leconAcademie.findUnique({ where: { id: leconId }, select: { coursId: true } });
    if (!l) throw new NotFoundException('Leçon introuvable');
    await this.coursVisible(l.coursId, qui);
    if (terminee) await this.prisma.progressionAcademie.upsert({ where: { userId_leconId: { userId, leconId } }, create: { userId, leconId }, update: {} });
    else await this.prisma.progressionAcademie.deleteMany({ where: { userId, leconId } });
    return { ok: true, faite: terminee };
  }

  /** HTML d'un simulateur (renvoyé en JSON : jamais servi comme page de l'app, il s'affiche dans une iframe isolée). */
  async htmlSimulateur(id: string) {
    const s = await this.prisma.simulateurAcademie.findUnique({ where: { id } });
    const flux = s && this.stockage.lire(s.cle);
    if (!s || !flux) throw new NotFoundException('Simulateur introuvable');
    const morceaux: Buffer[] = [];
    for await (const m of flux) morceaux.push(m as Buffer);
    return { id: s.id, nom: s.nom, html: Buffer.concat(morceaux).toString('utf8') };
  }

  async lireFichier(id: string) {
    const f = await this.prisma.fichierAcademie.findUnique({ where: { id } });
    const flux = f && this.stockage.lire(f.cle);
    if (!f || !flux) throw new NotFoundException();
    return { flux, type: f.type, nom: f.nom };
  }

  async lireCouverture(id: string) {
    const c = await this.prisma.coursAcademie.findUnique({ where: { id } });
    const flux = c?.couvertureCle && this.stockage.lire(c.couvertureCle);
    if (!c?.couvertureCle || !flux) throw new NotFoundException();
    return { flux, ext: c.couvertureCle.split('.').pop()! };
  }

  // ---------- administration ----------

  async listerAdmin() {
    const l = await this.prisma.coursAcademie.findMany({
      include: { lecons: { orderBy: { ordre: 'asc' }, select: { id: true, titre: true, ordre: true, blocs: true } } },
      orderBy: [{ espace: 'asc' }, { ordre: 'asc' }, { createdAt: 'asc' }],
    });
    return Promise.all(
      l.map(async (c) => ({
        id: c.id, titre: c.titre, description: c.description, publie: c.publie, espace: c.espace, type: c.type, ...this.vignette(c),
        cibleCategories: c.cibleCategories, cibleModeles: c.cibleModeles, pourQui: await this.pourQui(c),
        nbLecons: c.lecons.length, updatedAt: c.updatedAt,
      })),
    );
  }

  /** Une page est créée avec sa leçon unique (son contenu). */
  async creerCours(d: { espace: string; type?: 'parcours' | 'page'; titre: string; description?: string | null }) {
    verifierEspace(d.espace);
    const ordre = ((await this.prisma.coursAcademie.aggregate({ where: { espace: d.espace }, _max: { ordre: true } }))._max.ordre ?? -1) + 1;
    const type = d.type ?? 'parcours';
    return this.prisma.coursAcademie.create({
      data: {
        espace: d.espace, type, titre: d.titre.trim(), description: d.description?.trim() || null, ordre,
        ...(type === 'page' ? { lecons: { create: { titre: d.titre.trim(), ordre: 0, blocs: [] } } } : {}),
      },
      include: { lecons: { select: { id: true } } },
    });
  }

  async modifierCours(id: string, d: { type?: 'parcours' | 'page'; titre?: string; description?: string | null; publie?: boolean; espace?: string; cibleCategories?: string[]; cibleModeles?: string[] }) {
    await this.existeCours(id);
    if (d.espace) verifierEspace(d.espace);
    // devenir une page : il lui faut au moins une leçon (son contenu)
    if (d.type === 'page' && !(await this.prisma.leconAcademie.count({ where: { coursId: id } })))
      await this.prisma.leconAcademie.create({ data: { coursId: id, titre: d.titre?.trim() || 'Contenu', ordre: 0, blocs: [] } });
    return this.prisma.coursAcademie.update({
      where: { id },
      data: {
        ...(d.type ? { type: d.type } : {}),
        ...(d.titre !== undefined ? { titre: d.titre.trim() } : {}),
        ...(d.description !== undefined ? { description: d.description?.trim() || null } : {}),
        ...(d.publie !== undefined ? { publie: d.publie } : {}),
        ...(d.espace ? { espace: d.espace } : {}),
        ...(d.cibleCategories ? { cibleCategories: nettoyerListe(d.cibleCategories) } : {}),
        ...(d.cibleModeles ? { cibleModeles: [...new Set(d.cibleModeles)] } : {}),
      },
    });
  }

  async supprimerCours(id: string) {
    const c = await this.existeCours(id);
    await this.prisma.coursAcademie.delete({ where: { id } });
    if (c.couvertureCle) await this.stockage.supprimer(c.couvertureCle);
    return { ok: true };
  }

  async deplacerCours(id: string, sens: -1 | 1) {
    const c = await this.existeCours(id);
    const l = await this.prisma.coursAcademie.findMany({ where: { espace: c.espace }, orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }] });
    const i = l.findIndex((x) => x.id === id);
    const j = i + sens;
    if (j >= 0 && j < l.length) [l[i], l[j]] = [l[j], l[i]];
    await this.prisma.$transaction(l.map((x, n) => this.prisma.coursAcademie.update({ where: { id: x.id }, data: { ordre: n } })));
    return { ok: true };
  }

  async couverture(id: string, f?: Express.Multer.File) {
    const c = await this.existeCours(id);
    if (c.couvertureCle) await this.stockage.supprimer(c.couvertureCle);
    let cle: string | null = null;
    if (f) {
      const fmt = formatImage(f.buffer);
      if (!fmt) throw new BadRequestException('Image PNG, JPEG ou WebP attendue');
      cle = `academie/couvertures/${id}-${randomUUID()}.${fmt}`;
      await this.stockage.ecrire(cle, f.buffer);
    }
    await this.prisma.coursAcademie.update({ where: { id }, data: { couvertureCle: cle } });
    return { ok: true };
  }

  async creerLecon(coursId: string, d: { titre: string; blocs?: unknown }) {
    await this.existeCours(coursId);
    const blocs = d.blocs ? nettoyerBlocs(d.blocs) : [];
    const ordre = ((await this.prisma.leconAcademie.aggregate({ where: { coursId }, _max: { ordre: true } }))._max.ordre ?? -1) + 1;
    const l = await this.prisma.leconAcademie.create({ data: { coursId, titre: d.titre.trim(), ordre, blocs: blocs as Prisma.InputJsonValue } });
    await this.toucher(coursId);
    return l;
  }

  async modifierLecon(id: string, d: { titre?: string; blocs?: unknown }) {
    const l = await this.existeLecon(id);
    const r = await this.prisma.leconAcademie.update({
      where: { id },
      data: {
        ...(d.titre !== undefined ? { titre: d.titre.trim() } : {}),
        ...(d.blocs !== undefined ? { blocs: nettoyerBlocs(d.blocs) as Prisma.InputJsonValue } : {}),
      },
    });
    await this.toucher(l.coursId);
    return r;
  }

  async supprimerLecon(id: string) {
    const l = await this.existeLecon(id);
    await this.prisma.leconAcademie.delete({ where: { id } });
    await this.toucher(l.coursId);
    return { ok: true };
  }

  async deplacerLecon(id: string, sens: -1 | 1) {
    const lecon = await this.existeLecon(id);
    const l = await this.prisma.leconAcademie.findMany({ where: { coursId: lecon.coursId }, orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }] });
    const i = l.findIndex((x) => x.id === id);
    const j = i + sens;
    if (j >= 0 && j < l.length) [l[i], l[j]] = [l[j], l[i]];
    await this.prisma.$transaction(l.map((x, n) => this.prisma.leconAcademie.update({ where: { id: x.id }, data: { ordre: n } })));
    return { ok: true };
  }

  /** Le cours change (vignette recalculée) quand ses leçons changent. */
  private toucher(coursId: string) {
    return this.prisma.coursAcademie.update({ where: { id: coursId }, data: { updatedAt: new Date() } });
  }

  // simulateurs
  listerSimulateurs() {
    return this.prisma.simulateurAcademie.findMany({ orderBy: [{ espace: 'asc' }, { nom: 'asc' }], select: { id: true, nom: true, espace: true, modeleId: true, updatedAt: true } });
  }

  private lireHtml(f?: Express.Multer.File) {
    if (!f) throw new BadRequestException('Fichier HTML manquant');
    const html = f.buffer.toString('utf8');
    if (!/<(!doctype|html|body|div|script|canvas|svg)/i.test(html.slice(0, 5000))) throw new BadRequestException('Fichier HTML attendu');
    return f.buffer;
  }

  async creerSimulateur(d: { nom: string; espace: string; modeleId?: string | null }, f?: Express.Multer.File) {
    verifierEspace(d.espace);
    const contenu = this.lireHtml(f);
    const cle = `academie/simulateurs/${randomUUID()}.html`;
    await this.stockage.ecrire(cle, contenu);
    return this.prisma.simulateurAcademie.create({ data: { nom: d.nom.trim(), espace: d.espace, modeleId: d.modeleId || null, cle }, select: { id: true, nom: true, espace: true, modeleId: true } });
  }

  async modifierSimulateur(id: string, d: { nom?: string; modeleId?: string | null }, f?: Express.Multer.File) {
    const s = await this.prisma.simulateurAcademie.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Simulateur introuvable');
    let cle = s.cle;
    if (f) {
      cle = `academie/simulateurs/${randomUUID()}.html`;
      await this.stockage.ecrire(cle, this.lireHtml(f));
      await this.stockage.supprimer(s.cle);
    }
    return this.prisma.simulateurAcademie.update({
      where: { id },
      data: { cle, ...(d.nom ? { nom: d.nom.trim() } : {}), ...(d.modeleId !== undefined ? { modeleId: d.modeleId || null } : {}) },
      select: { id: true, nom: true, espace: true, modeleId: true },
    });
  }

  async supprimerSimulateur(id: string) {
    const s = await this.prisma.simulateurAcademie.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Simulateur introuvable');
    await this.prisma.simulateurAcademie.delete({ where: { id } });
    await this.stockage.supprimer(s.cle);
    return { ok: true };
  }

  /** Image (PNG, JPEG, WebP) ou PDF pour un bloc. */
  async envoyerFichier(f?: Express.Multer.File) {
    if (!f) throw new BadRequestException('Fichier manquant');
    const img = formatImage(f.buffer);
    const pdf = f.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    if (!img && !pdf) throw new BadRequestException('Image (PNG, JPEG, WebP) ou PDF attendu');
    const ext = img ?? 'pdf';
    const cle = `academie/fichiers/${randomUUID()}.${ext}`;
    await this.stockage.ecrire(cle, f.buffer);
    const type = img ? `image/${img === 'jpg' ? 'jpeg' : img}` : 'application/pdf';
    const r = await this.prisma.fichierAcademie.create({ data: { cle, nom: (f.originalname || `fichier.${ext}`).slice(0, 200), type } });
    return { id: r.id, nom: r.nom, type, chemin: `/academie/fichiers/${r.id}` };
  }

  private async existeCours(id: string) {
    const c = await this.prisma.coursAcademie.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Cours introuvable');
    return c;
  }

  private async existeLecon(id: string) {
    const l = await this.prisma.leconAcademie.findUnique({ where: { id } });
    if (!l) throw new NotFoundException('Leçon introuvable');
    return l;
  }
}
