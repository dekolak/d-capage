import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Role, Visibilite } from '@prisma/client';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ModuleRequis, Moi, Principal, Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

class CreerTagDto {
  @IsString() groupeId!: string;
  @IsString() @MinLength(2) @MaxLength(40) nom!: string;
}

class ModifierTagDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40) nom?: string;
}

class CorrigerPrecisionDto {
  @IsString() groupeId!: string;
  @IsString() @MinLength(1) @MaxLength(80) de!: string;
  @IsString() @MinLength(1) @MaxLength(80) vers!: string;
}

class PromouvoirPrecisionDto {
  @IsString() groupeId!: string;
  @IsString() @MinLength(1) @MaxLength(80) texte!: string;
  /** Nom de la nouvelle famille (par défaut : le texte de la précision). */
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40) nom?: string;
}

export const slugifier = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Même précision malgré la casse, les espaces et les accents (« 316 L » = « 316l »). */
export const clePrecision = (s: string) => slugifier(s).replace(/-/g, '');
/** Ordre alphabétique, « Autre » toujours en fin de liste. */
const comparerTags = (a: { slug: string; nom: string }, b: { slug: string; nom: string }) =>
  Number(a.slug === 'autre') - Number(b.slug === 'autre') || a.nom.localeCompare(b.nom, 'fr');

/**
 * Familles (listes courtes gérées par l'admin : Matériau, À enlever, Application) et précisions libres des clients.
 * Module « Réglages décapage » (espace Lazzeko).
 */
@ModuleRequis('reglages-decapage')
@Controller('tags')
export class TagsController {
  constructor(private prisma: PrismaService) {}

  /** Groupes et leurs familles (« Autre » en dernier). */
  @Get()
  async lister() {
    const l = await this.prisma.groupeTag.findMany({
      orderBy: { ordre: 'asc' },
      include: { tags: { where: { valide: true }, select: { id: true, slug: true, nom: true } } },
    });
    return l.map((g) => ({ ...g, tags: g.tags.sort(comparerTags) }));
  }

  /**
   * Suggestions pendant la saisie d'une précision : celles déjà utilisées (fiches partagées ou les miennes),
   * d'abord dans la famille choisie, les plus utilisées en premier.
   */
  @Get('precisions')
  async suggestions(@Moi() moi: Principal, @Query('groupeId') groupeId: string, @Query('q') q = '', @Query('tagId') tagId?: string) {
    if (!groupeId) throw new BadRequestException('groupeId requis');
    const l = await this.prisma.fichePrecision.findMany({
      where: {
        groupeId,
        ...(q.trim() ? { texte: { contains: q.trim(), mode: 'insensitive' } } : {}),
        fiche: { OR: [{ visibilite: Visibilite.PARTAGEE, masquee: false }, { userId: moi.id }] },
      },
      select: { texte: true, fiche: { select: { tags: { select: { tagId: true } } } } },
      take: 500,
    });
    const parCle = new Map<string, { texte: string; nb: number; famille: number }>();
    for (const p of l) {
      const k = clePrecision(p.texte);
      const e = parCle.get(k) ?? { texte: p.texte.trim(), nb: 0, famille: 0 };
      e.nb++;
      if (tagId && p.fiche.tags.some((t) => t.tagId === tagId)) e.famille++;
      parCle.set(k, e);
    }
    return [...parCle.values()].sort((a, b) => b.famille - a.famille || b.nb - a.nb).slice(0, 8).map(({ texte, nb }) => ({ texte, nb }));
  }

  /** Nouvelle famille (admin). */
  @Post()
  @Roles(Role.ADMIN)
  async creer(@Body() dto: CreerTagDto) {
    const g = await this.prisma.groupeTag.findUnique({ where: { id: dto.groupeId } });
    if (!g) throw new NotFoundException('Groupe inconnu');
    const slug = slugifier(dto.nom);
    return this.prisma.tag.upsert({
      where: { groupeId_slug: { groupeId: g.id, slug } },
      update: { valide: true },
      create: { groupeId: g.id, slug, nom: dto.nom.trim() },
    });
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  modifier(@Param('id') id: string, @Body() dto: ModifierTagDto) {
    return this.prisma.tag.update({ where: { id }, data: { ...(dto.nom ? { nom: dto.nom.trim() } : {}) } });
  }
}

/** Précisions saisies par les clients (admin) : regroupées, à corriger / fusionner, ou à transformer en famille. */
@Roles(Role.ADMIN)
@Controller('admin/precisions')
export class AdminPrecisionsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async lister() {
    const [groupes, l] = await Promise.all([
      this.prisma.groupeTag.findMany({ orderBy: { ordre: 'asc' }, select: { id: true, nom: true, slug: true } }),
      this.prisma.fichePrecision.findMany({
        select: { texte: true, groupeId: true, fiche: { select: { tags: { select: { tag: { select: { nom: true, groupeId: true } } } } } } },
      }),
    ]);
    return groupes.map((g) => {
      const parCle = new Map<string, { texte: string; variantes: Set<string>; nb: number; familles: Map<string, number> }>();
      for (const p of l.filter((x) => x.groupeId === g.id)) {
        const k = clePrecision(p.texte);
        const e = parCle.get(k) ?? { texte: p.texte.trim(), variantes: new Set<string>(), nb: 0, familles: new Map<string, number>() };
        e.nb++;
        e.variantes.add(p.texte.trim());
        for (const t of p.fiche.tags.filter((x) => x.tag.groupeId === g.id)) e.familles.set(t.tag.nom, (e.familles.get(t.tag.nom) ?? 0) + 1);
        parCle.set(k, e);
      }
      return {
        ...g,
        precisions: [...parCle.values()]
          .sort((a, b) => b.nb - a.nb || a.texte.localeCompare(b.texte, 'fr'))
          .map((e) => ({ texte: e.texte, nb: e.nb, variantes: [...e.variantes], familles: [...e.familles].map(([nom, nb]) => ({ nom, nb })) })),
      };
    });
  }

  /** Corriger ou fusionner : toutes les précisions équivalentes à `de` deviennent `vers`. */
  @Post('corriger')
  async corriger(@Body() d: CorrigerPrecisionDto) {
    const ids = await this.memes(d.groupeId, d.de);
    await this.prisma.fichePrecision.updateMany({ where: { id: { in: ids } }, data: { texte: d.vers.trim() } });
    return this.lister();
  }

  /**
   * Faire d'une précision une famille de la liste : les fiches concernées sont rangées dedans
   * (à la place de leur famille actuelle si le groupe est à choix unique) et la précision est retirée.
   */
  @Post('promouvoir')
  async promouvoir(@Body() d: PromouvoirPrecisionDto) {
    const g = await this.prisma.groupeTag.findUnique({ where: { id: d.groupeId } });
    if (!g) throw new NotFoundException('Groupe inconnu');
    const nom = (d.nom ?? d.texte).trim();
    const tag = await this.prisma.tag.upsert({
      where: { groupeId_slug: { groupeId: g.id, slug: slugifier(nom) } },
      update: { valide: true },
      create: { groupeId: g.id, slug: slugifier(nom), nom },
    });
    const ids = await this.memes(g.id, d.texte);
    const precisions = await this.prisma.fichePrecision.findMany({ where: { id: { in: ids } }, select: { ficheId: true } });
    const fiches = precisions.map((p) => p.ficheId);
    await this.prisma.$transaction([
      ...(g.choixUnique ? [this.prisma.ficheTag.deleteMany({ where: { ficheId: { in: fiches }, tag: { groupeId: g.id } } })] : []),
      this.prisma.ficheTag.createMany({ data: fiches.map((ficheId) => ({ ficheId, tagId: tag.id })), skipDuplicates: true }),
      this.prisma.fichePrecision.deleteMany({ where: { id: { in: ids } } }),
    ]);
    return this.lister();
  }

  private async memes(groupeId: string, texte: string) {
    const cle = clePrecision(texte);
    const l = await this.prisma.fichePrecision.findMany({ where: { groupeId }, select: { id: true, texte: true } });
    const ids = l.filter((p) => clePrecision(p.texte) === cle).map((p) => p.id);
    if (!ids.length) throw new NotFoundException('Précision introuvable');
    return ids;
  }
}
