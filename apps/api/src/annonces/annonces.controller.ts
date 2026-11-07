import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query } from '@nestjs/common';
import { CibleClient, NiveauAnnonce, Recurrence, Role, TypeQuestion } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDate, IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { AutoriseCleApi, Moi, Principal, Roles } from '../auth/decorators';
import { AnnoncesService } from './annonces.service';

class CiblageDto {
  @IsOptional() @IsEnum(CibleClient) cibleClient?: CibleClient;
  @IsOptional() @IsArray() @IsString({ each: true }) fabricantIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) modeleIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) varianteIds?: string[];
}

class AnnonceDto extends CiblageDto {
  @IsString() @MinLength(2) @MaxLength(120) titre!: string;
  @IsString() @MinLength(2) @MaxLength(2000) texte!: string;
  @IsOptional() @IsEnum(NiveauAnnonce) niveau?: NiveauAnnonce;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsUrl({ require_protocol: true }) lienUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(40) lienTexte?: string | null;
  @IsOptional() @Type(() => Date) @IsDate() debut?: Date;
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Date) @IsDate() fin?: Date | null;
  @IsOptional() @IsBoolean() actif?: boolean;
  @IsOptional() @IsEnum(Recurrence) recurrence?: Recurrence;
  @IsOptional() @IsInt() @Min(1) @Max(365) intervalle?: number;
  @IsOptional() @IsEnum(TypeQuestion) questionType?: TypeQuestion;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(300) question?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) @MaxLength(80, { each: true }) options?: string[];
  @IsOptional() @IsBoolean() autreOption?: boolean;
  @IsOptional() @IsBoolean() reponseObligatoire?: boolean;
}

class ReponseDto {
  @IsString() @MinLength(1) @MaxLength(1000) valeur!: string;
  @IsOptional() @IsString() @MaxLength(300) autre?: string;
}

class ModifierAnnonceDto extends AnnonceDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) declare titre: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(2000) declare texte: string;
}

const nettoyer = <T extends { lienUrl?: string | null; lienTexte?: string | null; options?: string[] }>(d: T) => ({
  ...d,
  ...(d.options !== undefined ? { options: d.options.map((o) => o.trim()).filter(Boolean) } : {}),
  ...(d.lienUrl !== undefined ? { lienUrl: d.lienUrl || null } : {}),
  ...(d.lienTexte !== undefined ? { lienTexte: d.lienTexte || null } : {}),
});

@Controller()
export class AnnoncesController {
  constructor(private annonces: AnnoncesService) {}

  /** Messages à afficher à l'ouverture de l'app. */
  @Get('annonces')
  pourMoi(@Moi() moi: Principal) {
    return this.annonces.pourMoi(moi.id);
  }

  /** « J'ai compris » : masque le message (jusqu'à la prochaine période pour un message périodique). */
  @Post('annonces/:id/compris')
  compris(@Moi() moi: Principal, @Param('id') id: string) {
    return this.annonces.compris(id, moi.id);
  }

  /** Réponse à la question du message (masque aussi le message pour la période). */
  @Post('annonces/:id/reponse')
  repondre(@Moi() moi: Principal, @Param('id') id: string, @Body() dto: ReponseDto) {
    return this.annonces.repondre(id, moi.id, dto.valeur, dto.autre);
  }

  // --- administration (admin, ou clé API pour programmer des messages depuis Odoo) ---
  @Get('admin/annonces/:id/reponses')
  @Roles(Role.ADMIN)
  @AutoriseCleApi()
  resultats(@Param('id') id: string, @Query('occurrence') occurrence?: string) {
    return this.annonces.resultats(id, occurrence !== undefined && occurrence !== '' ? Number(occurrence) : undefined);
  }

  @Get('admin/annonces/:id/reponses.csv')
  @Roles(Role.ADMIN)
  @AutoriseCleApi()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="reponses.csv"')
  csv(@Param('id') id: string) {
    return this.annonces.csv(id);
  }

  @Get('admin/annonces')
  @Roles(Role.ADMIN)
  @AutoriseCleApi()
  lister() {
    return this.annonces.lister();
  }

  /** Nombre d'utilisateurs touchés par un ciblage (aperçu avant publication). */
  @Post('admin/annonces/cible')
  @Roles(Role.ADMIN)
  @AutoriseCleApi()
  async cible(@Body() c: CiblageDto) {
    return { utilisateurs: await this.annonces.compterCible(c) };
  }

  @Post('admin/annonces')
  @Roles(Role.ADMIN)
  @AutoriseCleApi()
  creer(@Body() dto: AnnonceDto) {
    return this.annonces.creer(nettoyer(dto));
  }

  @Patch('admin/annonces/:id')
  @Roles(Role.ADMIN)
  @AutoriseCleApi()
  modifier(@Param('id') id: string, @Body() dto: ModifierAnnonceDto) {
    return this.annonces.modifier(id, nettoyer(dto));
  }

  @Delete('admin/annonces/:id')
  @Roles(Role.ADMIN)
  @AutoriseCleApi()
  supprimer(@Param('id') id: string) {
    return this.annonces.supprimer(id);
  }
}
