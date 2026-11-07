import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CibleClient, NiveauAnnonce, Recurrence, Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDate, IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
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
}

class ModifierAnnonceDto extends AnnonceDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) declare titre: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(2000) declare texte: string;
}

const nettoyer = <T extends { lienUrl?: string | null; lienTexte?: string | null }>(d: T) => ({
  ...d,
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

  // --- administration (admin, ou clé API pour programmer des messages depuis Odoo) ---
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
