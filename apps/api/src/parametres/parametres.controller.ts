import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { EspaceCourant, Roles, SansConditions } from '../auth/decorators';
import { ESPACES } from '../espaces/espaces';
import { ParametresService } from './parametres.service';

class ModifierParametresDto {
  @IsOptional() @IsBoolean() aideSupport?: boolean;
}

class PublierConditionsDto {
  /** Espace concerné (lazzeko, kiavik…). Par défaut : l'espace courant. */
  @IsOptional() @IsIn(ESPACES.map((e) => e.slug)) espace?: string;
  @IsString() @MinLength(20) @MaxLength(50000) texte!: string;
}

@Controller()
export class ParametresController {
  constructor(private parametres: ParametresService) {}

  /** Lu par l'app pour savoir quelles fonctions afficher. */
  @Get('parametres')
  @SansConditions()
  async lire(@EspaceCourant() espace: string) {
    const p = await this.parametres.tous();
    return { aideSupport: p.aideSupport, conditionsVersion: await this.parametres.versionConditions(espace) };
  }

  @Patch('admin/parametres')
  @Roles(Role.ADMIN)
  async modifier(@Body() dto: ModifierParametresDto, @EspaceCourant() espace: string) {
    await this.parametres.modifier(dto);
    return this.lire(espace);
  }

  /** Conditions d'utilisation en vigueur pour un espace (?espace=, par défaut l'espace courant). */
  @Get('conditions')
  @SansConditions()
  conditions(@EspaceCourant() courant: string, @Query('espace') espace?: string) {
    return this.parametres.conditions(espace || courant);
  }

  /** Nouvelle version des conditions d'un espace : chacun devra les accepter à sa prochaine action. */
  @Post('admin/conditions')
  @Roles(Role.ADMIN)
  publier(@Body() dto: PublierConditionsDto, @EspaceCourant() courant: string) {
    return this.parametres.publierConditions(dto.espace ?? courant, dto.texte.trim());
  }
}
