import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CorrectionsService } from '../guides/corrections.service';
import { GuidesService } from '../guides/guides.service';
import { PrismaService } from '../prisma/prisma.service';
import { assurerCategorie } from './assurer';

/** Élément rangé dans une catégorie : procédure (ou diagnostic), astuce, animation d'un guide. */
export type TypeElement = 'procedure' | 'astuce' | 'animation';
export interface RefElement { type: TypeElement; id: string; guide?: string }

/**
 * Catégories de l'accueil Kiavik : liste (ordre, icône, masquée), et pour l'admin un seul endroit pour
 * renommer, ajouter, ordonner, masquer, supprimer, et ranger les procédures, astuces et animations.
 */
@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService, private guides: GuidesService, private corrections: CorrectionsService) {}

  lister() {
    return this.prisma.categorieAccueil.findMany({ orderBy: [{ ordre: 'asc' }, { nom: 'asc' }] });
  }

  /** Tous les éléments rangeables, avec leur catégorie actuelle. */
  async elements() {
    const [procedures, astuces, cats] = await Promise.all([
      this.prisma.procedure.findMany({
        orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, titre: true, categorie: true, publiee: true, etapes: { select: { guide: true, _count: { select: { choix: true } } } } },
      }),
      this.prisma.solution.findMany({ orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }], select: { id: true, titre: true, categorie: true, publiee: true, guide: true } }),
      this.corrections.categoriesAnimations(),
    ]);
    const ordres = await this.corrections.ordresAnimations();
    const animations = this.guides
      .lister('tous')
      .flatMap((g, gi) =>
        g.animations.map((a, i) => ({
          type: 'animation' as const, id: a.id, guide: g.slug, titre: a.titre, categorie: cats[g.slug]?.[a.id] ?? a.categorie ?? '', publiee: true, logiciels: [g.slug],
          ordre: ordres[g.slug]?.[a.id] ?? 1000 + gi * 100 + i,
        })),
      )
      .sort((a, b) => a.ordre - b.ordre)
      .map(({ ordre: _o, ...a }) => a);
    return [
      ...procedures.map((p) => ({
        type: 'procedure' as const, id: p.id, titre: p.titre, categorie: p.categorie, publiee: p.publiee,
        diagnostic: p.etapes.some((e) => e._count.choix > 0),
        logiciels: [...new Set(p.etapes.map((e) => e.guide).filter((x): x is string => !!x))],
      })),
      ...astuces.map((s) => ({ type: 'astuce' as const, id: s.id, titre: s.titre, categorie: s.categorie, publiee: s.publiee, logiciels: s.guide ? [s.guide] : [] })),
      ...animations,
    ];
  }

  async creer(d: { nom: string; icone?: string }) {
    const nom = d.nom.trim();
    if (await this.prisma.categorieAccueil.findUnique({ where: { nom } })) throw new BadRequestException('Cette catégorie existe déjà');
    const ordre = ((await this.prisma.categorieAccueil.aggregate({ _max: { ordre: true } }))._max.ordre ?? -1) + 1;
    await this.prisma.categorieAccueil.create({ data: { nom, icone: d.icone?.trim() || '📁', ordre } });
    return this.lister();
  }

  /** Modifier : icône, masquée, et renommer (tout son contenu suit, animations comprises). */
  async modifier(id: string, d: { nom?: string; icone?: string; masquee?: boolean }) {
    const c = await this.categorie(id);
    const nom = d.nom?.trim();
    const renommee = !!nom && nom !== c.nom;
    if (renommee && (await this.prisma.categorieAccueil.findUnique({ where: { nom } }))) throw new BadRequestException('Cette catégorie existe déjà');
    // la catégorie d'abord (garde son icône, son ordre), puis son contenu la suit
    await this.prisma.categorieAccueil.update({
      where: { id },
      data: { ...(renommee ? { nom } : {}), ...(d.icone !== undefined ? { icone: d.icone.trim() || '📁' } : {}), ...(d.masquee !== undefined ? { masquee: d.masquee } : {}) },
    });
    if (renommee) await this.deplacerContenu(c.nom, nom);
    return this.lister();
  }

  /** Monter (-1) ou descendre (+1). */
  async deplacer(id: string, sens: -1 | 1) {
    await this.categorie(id);
    const l = await this.lister();
    const i = l.findIndex((x) => x.id === id);
    const j = i + sens;
    if (j >= 0 && j < l.length) [l[i], l[j]] = [l[j], l[i]];
    await this.prisma.$transaction(l.map((x, n) => this.prisma.categorieAccueil.update({ where: { id: x.id }, data: { ordre: n } })));
    return this.lister();
  }

  /** Supprimer : si elle contient des éléments, `vers` (une autre catégorie) est obligatoire et reçoit le contenu. */
  async supprimer(id: string, vers?: string) {
    const c = await this.categorie(id);
    const n = (await this.elements()).filter((e) => e.categorie === c.nom).length;
    if (n) {
      const cible = vers ? await this.prisma.categorieAccueil.findUnique({ where: { id: vers } }) : null;
      if (!cible || cible.id === id) throw new BadRequestException(`Elle contient ${n} élément(s) : choisir la catégorie qui les reçoit`);
      await this.deplacerContenu(c.nom, cible.nom);
    }
    await this.prisma.categorieAccueil.delete({ where: { id } });
    return this.lister();
  }

  /** Ranger des éléments dans une catégorie (créée si besoin). */
  async ranger(elements: RefElement[], categorie: string) {
    const nom = categorie.trim();
    await assurerCategorie(this.prisma, nom);
    const ids = (t: TypeElement) => elements.filter((e) => e.type === t).map((e) => e.id);
    await this.prisma.procedure.updateMany({ where: { id: { in: ids('procedure') } }, data: { categorie: nom } });
    await this.prisma.solution.updateMany({ where: { id: { in: ids('astuce') } }, data: { categorie: nom } });
    for (const e of elements.filter((x) => x.type === 'animation')) {
      if (!e.guide) throw new BadRequestException('Guide manquant pour une animation');
      await this.corrections.categorieAnimation(e.guide, e.id, nom);
    }
    return { ok: true };
  }

  /**
   * Ordre d'affichage dans une catégorie de l'accueil, pour un type : la liste complète, dans le nouvel ordre.
   * Pas-à-pas et Bon à savoir : on redistribue leurs propres numéros d'ordre (les autres catégories ne bougent pas).
   */
  async ordonner(type: TypeElement, elements: RefElement[]) {
    if (type === 'animation') {
      if (elements.some((e) => !e.guide)) throw new BadRequestException('Guide manquant pour une animation');
      await this.corrections.ordonnerAnimations(elements.map((e) => ({ guide: e.guide!, id: e.id })));
      return { ok: true };
    }
    const ids = elements.map((e) => e.id);
    const table = type === 'procedure' ? this.prisma.procedure : this.prisma.solution;
    const actuels = await (table as typeof this.prisma.procedure).findMany({ where: { id: { in: ids } }, select: { id: true, ordre: true } });
    if (actuels.length !== ids.length) throw new NotFoundException('Élément introuvable');
    let ordres = actuels.map((x) => x.ordre).sort((a, b) => a - b);
    if (new Set(ordres).size < ordres.length) ordres = ordres.map((_, i) => ordres[0] + i);
    await this.prisma.$transaction(
      ids.map((id, n) =>
        type === 'procedure'
          ? this.prisma.procedure.update({ where: { id }, data: { ordre: ordres[n] } })
          : this.prisma.solution.update({ where: { id }, data: { ordre: ordres[n] } }),
      ),
    );
    return { ok: true };
  }

  /** Tout ce qui est dans la catégorie `de` passe dans `vers`. */
  private async deplacerContenu(de: string, vers: string) {
    const contenu = (await this.elements()).filter((e) => e.categorie === de);
    await this.ranger(contenu.map((e) => ({ type: e.type, id: e.id, ...('guide' in e ? { guide: e.guide } : {}) })), vers);
  }

  private async categorie(id: string) {
    const c = await this.prisma.categorieAccueil.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Catégorie introuvable');
    return c;
  }
}
