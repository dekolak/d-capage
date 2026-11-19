import { BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Put, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Moi, Principal, Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

/**
 * « C'était clair ? » en fin de contenu (pas-à-pas, leçon ou page de l'Académie), activé contenu par contenu
 * (« demanderAvis ») : pour vérifier que les nouveaux contenus sont bien compris. Un avis par client et par contenu.
 */
type TypeContenu = 'procedure' | 'lecon';

class AvisDto {
  @IsIn(['procedure', 'lecon']) type!: TypeContenu;
  @IsString() @MaxLength(40) id!: string;
  @IsBoolean() clair!: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(2000) commentaire?: string | null;
}
class TraiteDto {
  @IsBoolean() traite!: boolean;
}

@Injectable()
export class AvisContenuService {
  constructor(private prisma: PrismaService) {}

  /** Le contenu existe, est publié et demande l'avis des clients. */
  private async verifier(type: TypeContenu, id: string) {
    const ok = type === 'procedure'
      ? await this.prisma.procedure.count({ where: { id, publiee: true, demanderAvis: true } })
      : await this.prisma.leconAcademie.count({ where: { id, cours: { publie: true, demanderAvis: true } } });
    if (!ok) throw new NotFoundException('Contenu introuvable');
  }

  async mien(userId: string, type: TypeContenu, id: string) {
    const a = await this.prisma.avisContenu.findUnique({ where: { type_contenuId_userId: { type, contenuId: id, userId } } });
    return a ? { clair: a.clair, commentaire: a.commentaire } : null;
  }

  /** Donner ou changer son avis (redevient « à traiter »). */
  async donner(userId: string, d: AvisDto) {
    await this.verifier(d.type, d.id);
    const commentaire = d.commentaire?.trim() || null;
    const a = await this.prisma.avisContenu.upsert({
      where: { type_contenuId_userId: { type: d.type, contenuId: d.id, userId } },
      create: { type: d.type, contenuId: d.id, userId, clair: d.clair, commentaire },
      update: { clair: d.clair, commentaire, traite: false },
    });
    return { clair: a.clair, commentaire: a.commentaire };
  }

  /** Par contenu (titre, où), du plus de 🤔 à traiter au moins ; les avis avec le client. */
  async liste() {
    const l = await this.prisma.avisContenu.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { id: true, nom: true, identifiant: true, numeroOdoo: true } } },
    });
    const ids = (t: TypeContenu) => [...new Set(l.filter((a) => a.type === t).map((a) => a.contenuId))];
    const [procs, lecons] = await Promise.all([
      this.prisma.procedure.findMany({ where: { id: { in: ids('procedure') } }, select: { id: true, titre: true, espace: true, demanderAvis: true } }),
      this.prisma.leconAcademie.findMany({ where: { id: { in: ids('lecon') } }, select: { id: true, titre: true, cours: { select: { id: true, titre: true, espace: true, type: true, demanderAvis: true } } } }),
    ]);
    const infos = new Map<string, { titre: string; ou: string; espace: string; lien: string; actif: boolean }>([
      ...procs.map((p) => [`procedure:${p.id}`, { titre: p.titre, ou: 'Pas-à-pas', espace: p.espace, lien: `/admin/procedures/${p.id}`, actif: p.demanderAvis }] as const),
      ...lecons.map((x) => [`lecon:${x.id}`, {
        titre: x.cours.type === 'page' ? x.cours.titre : `${x.cours.titre} › ${x.titre}`, ou: x.cours.type === 'page' ? 'Académie · page' : 'Académie · leçon',
        espace: x.cours.espace, lien: `/admin/academie/cours/${x.cours.id}`, actif: x.cours.demanderAvis,
      }] as const),
    ]);
    const groupes = new Map<string, { type: string; contenuId: string; titre: string; ou: string; espace: string; lien: string; actif: boolean; clairs: number; flous: number; aTraiter: number; avis: unknown[] }>();
    for (const a of l) {
      const k = `${a.type}:${a.contenuId}`;
      const info = infos.get(k);
      if (!info) continue; // contenu supprimé
      const g = groupes.get(k) ?? { type: a.type, contenuId: a.contenuId, ...info, clairs: 0, flous: 0, aTraiter: 0, avis: [] };
      if (a.clair) g.clairs++;
      else g.flous++;
      if (!a.clair && !a.traite) g.aTraiter++;
      g.avis.push({ id: a.id, clair: a.clair, commentaire: a.commentaire, traite: a.traite, le: a.updatedAt, client: a.user });
      groupes.set(k, g);
    }
    return [...groupes.values()].sort((a, b) => b.aTraiter - a.aTraiter || b.flous - a.flous);
  }

  /** Nombre de « pas tout compris » à traiter (badge de l'administration). */
  async aTraiter() {
    return { n: await this.prisma.avisContenu.count({ where: { clair: false, traite: false } }) };
  }

  async traiter(id: string, traite: boolean) {
    if (!(await this.prisma.avisContenu.findUnique({ where: { id } }))) throw new NotFoundException();
    await this.prisma.avisContenu.update({ where: { id }, data: { traite } });
    return { ok: true };
  }
}

@Controller('avis-contenu')
export class AvisContenuController {
  constructor(private avis: AvisContenuService) {}

  @Get()
  mien(@Moi() moi: Principal, @Query('type') type: string, @Query('id') id: string) {
    if (type !== 'procedure' && type !== 'lecon') throw new BadRequestException('type : procedure ou lecon');
    return this.avis.mien(moi.id, type, id ?? '');
  }

  @Put()
  donner(@Moi() moi: Principal, @Body() d: AvisDto) {
    return this.avis.donner(moi.id, d);
  }
}

@Roles(Role.ADMIN)
@Controller('admin/avis-contenu')
export class AdminAvisContenuController {
  constructor(private avis: AvisContenuService) {}

  @Get()
  liste() {
    return this.avis.liste();
  }

  @Get('a-traiter')
  aTraiter() {
    return this.avis.aTraiter();
  }

  @Patch(':id')
  traiter(@Param('id') id: string, @Body() d: TraiteDto) {
    return this.avis.traiter(id, d.traite);
  }
}

@Module({ controllers: [AvisContenuController, AdminAvisContenuController], providers: [AvisContenuService] })
export class AvisContenuModule {}
