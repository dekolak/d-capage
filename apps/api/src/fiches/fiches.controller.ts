import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AutoriseCleApi, Moi, Principal, Roles } from '../auth/decorators';
import { CreerFicheDto, EvaluerDto, FiltresAdminDto, FiltresAvisDto, FiltresDto, MasquerDto, ModererAvisDto, ModifierFicheDto } from './fiches.dto';
import { FichesService } from './fiches.service';

@Controller()
export class FichesController {
  constructor(private fiches: FichesService) {}

  @Get('fiches')
  mesFiches(@Moi() moi: Principal, @Query() f: FiltresDto) {
    return this.fiches.mesFiches(moi, f);
  }

  /** Fiches partagées par tous, triées par note par défaut. */
  @Get('communaute')
  communaute(@Moi() moi: Principal, @Query() f: FiltresDto) {
    return this.fiches.communaute(moi, f);
  }

  @Post('fiches')
  creer(@Moi() moi: Principal, @Body() dto: CreerFicheDto) {
    return this.fiches.creer(moi, dto);
  }

  @Get('fiches/:id')
  detail(@Moi() moi: Principal, @Param('id') id: string) {
    return this.fiches.detail(id, moi);
  }

  @Patch('fiches/:id')
  modifier(@Moi() moi: Principal, @Param('id') id: string, @Body() dto: ModifierFicheDto) {
    return this.fiches.modifier(id, moi, dto);
  }

  @Delete('fiches/:id')
  supprimer(@Moi() moi: Principal, @Param('id') id: string) {
    return this.fiches.supprimer(id, moi);
  }

  @Post('fiches/:id/evaluation')
  evaluer(@Moi() moi: Principal, @Param('id') id: string, @Body() dto: EvaluerDto) {
    return this.fiches.evaluer(id, moi, dto);
  }

  @Delete('fiches/:id/evaluation')
  retirerEvaluation(@Moi() moi: Principal, @Param('id') id: string) {
    return this.fiches.retirerEvaluation(id, moi);
  }

  // --- administration ---
  @Get('admin/fiches')
  @Roles(Role.ADMIN)
  adminFiches(@Moi() moi: Principal, @Query() f: FiltresAdminDto) {
    return this.fiches.adminFiches(moi, f);
  }

  /** Masquer / réafficher une fiche (modération) : admin, ou service externe (IA) via clé API. */
  @Patch('admin/fiches/:id')
  @Roles(Role.ADMIN)
  @AutoriseCleApi()
  masquer(@Moi() moi: Principal, @Param('id') id: string, @Body() dto: MasquerDto) {
    return this.fiches.masquer(id, dto.masquee, moi, dto.raison);
  }

  @Get('admin/avis')
  @Roles(Role.ADMIN)
  @AutoriseCleApi()
  adminAvis(@Query() f: FiltresAvisDto) {
    return this.fiches.adminAvis(f);
  }

  /** Masquer / réafficher / valider un avis : admin, ou service externe (IA) via clé API. */
  @Patch('admin/avis/:id')
  @Roles(Role.ADMIN)
  @AutoriseCleApi()
  modererAvis(@Moi() moi: Principal, @Param('id') id: string, @Body() dto: ModererAvisDto) {
    return this.fiches.modererAvis(id, dto.statut, moi, dto.raison);
  }
}
