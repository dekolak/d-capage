import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ModuleRequis, Moi, Principal, Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

class ProposerTagDto {
  @IsString() groupeId!: string;
  @IsString() @MinLength(2) @MaxLength(40) nom!: string;
}

class ModifierTagDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40) nom?: string;
  @IsOptional() @IsBoolean() valide?: boolean;
}

export const slugifier = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Module « Réglages décapage » (espace Lazzeko). */
@ModuleRequis('reglages-decapage')
@Controller('tags')
export class TagsController {
  constructor(private prisma: PrismaService) {}

  /** Groupes et tags validés. */
  @Get()
  lister() {
    return this.prisma.groupeTag.findMany({
      orderBy: { ordre: 'asc' },
      include: { tags: { where: { valide: true }, orderBy: { nom: 'asc' }, select: { id: true, slug: true, nom: true } } },
    });
  }

  @Get('a-valider')
  @Roles(Role.ADMIN)
  aValider() {
    return this.prisma.tag.findMany({ where: { valide: false }, include: { groupe: true } });
  }

  /** Un utilisateur propose un tag (utilisable tout de suite par lui, validé ensuite par l'admin). */
  @Post()
  async proposer(@Body() dto: ProposerTagDto, @Moi() moi: Principal) {
    const g = await this.prisma.groupeTag.findUnique({ where: { id: dto.groupeId } });
    if (!g) throw new NotFoundException('Groupe inconnu');
    const slug = slugifier(dto.nom);
    const existe = await this.prisma.tag.findUnique({ where: { groupeId_slug: { groupeId: g.id, slug } } });
    if (existe) return existe;
    return this.prisma.tag.create({ data: { groupeId: g.id, slug, nom: dto.nom.trim(), valide: moi.role === Role.ADMIN } });
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  modifier(@Param('id') id: string, @Body() dto: ModifierTagDto) {
    return this.prisma.tag.update({ where: { id }, data: dto });
  }
}
