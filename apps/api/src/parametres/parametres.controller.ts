import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Roles, SansConditions } from '../auth/decorators';
import { ParametresService } from './parametres.service';

class ModifierParametresDto {
  @IsOptional() @IsBoolean() aideSupport?: boolean;
}

class PublierConditionsDto {
  @IsString() @MinLength(20) @MaxLength(50000) texte!: string;
}

@Controller()
export class ParametresController {
  constructor(private parametres: ParametresService) {}

  /** Lu par l'app pour savoir quelles fonctions afficher. */
  @Get('parametres')
  @SansConditions()
  async lire() {
    const p = await this.parametres.tous();
    return { aideSupport: p.aideSupport, conditionsVersion: p.conditionsVersion };
  }

  @Patch('admin/parametres')
  @Roles(Role.ADMIN)
  async modifier(@Body() dto: ModifierParametresDto) {
    await this.parametres.modifier(dto);
    return this.lire();
  }

  /** Conditions d'utilisation en vigueur (affichées à l'accueil et dans le compte). */
  @Get('conditions')
  @SansConditions()
  async conditions() {
    const p = await this.parametres.tous();
    return { version: p.conditionsVersion, texte: p.conditionsTexte };
  }

  /** Nouvelle version des conditions : chaque utilisateur devra les accepter à sa prochaine action. */
  @Post('admin/conditions')
  @Roles(Role.ADMIN)
  publier(@Body() dto: PublierConditionsDto) {
    return this.parametres.publierConditions(dto.texte.trim());
  }
}
