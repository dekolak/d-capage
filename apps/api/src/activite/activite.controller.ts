import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { EspaceCourant, Moi, Principal, Roles, SansConditions } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { ActiviteService } from './activite.service';

class ActiviteDto {
  @IsIn(['page', 'recherche']) type!: 'page' | 'recherche';
  @IsOptional() @IsString() @MaxLength(300) chemin?: string;
  @IsOptional() @IsString() @MaxLength(200) detail?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100000) resultats?: number;
}

@Controller()
export class ActiviteController {
  constructor(private activite: ActiviteService, private prisma: PrismaService) {}

  /** Page consultée ou recherche faite par le client (les admins ne sont pas enregistrés). */
  @Post('activite')
  @SansConditions()
  @HttpCode(204)
  noter(@Moi() moi: Principal, @Body() d: ActiviteDto, @EspaceCourant() espace: string) {
    if (moi.type === 'user' && moi.role !== Role.ADMIN) this.activite.noter(moi.id, { ...d, espace });
  }

  /** Journal d'un compte (admin), du plus récent au plus ancien. */
  @Get('admin/users/:id/activite')
  @Roles(Role.ADMIN)
  async journal(@Param('id') id: string, @Query('jours') jours?: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, identifiant: true, nom: true, numeroOdoo: true } });
    if (!user) throw new NotFoundException();
    const j = Math.min(365, Math.max(1, Number(jours) || 30));
    return { user, jours: j, activites: await this.activite.lister(id, j) };
  }
}
