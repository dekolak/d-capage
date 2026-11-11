import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AutoriseCleApi, EspaceCourant, Public, Roles } from '../auth/decorators';
import { MotDePasseService } from './mot-de-passe.service';

class DemandeDto {
  /** Identifiant, ou email si le client l'a oublié aussi. */
  @IsString() @MinLength(1) @MaxLength(120) identifiant!: string;
  @IsOptional() @IsString() @MaxLength(300) message?: string;
}
class ReinitialiserDto {
  @IsString() @MinLength(1) @MaxLength(64) identifiant!: string;
  @IsString() @Matches(/^\s*\d{6}\s*$/, { message: 'Le code a 6 chiffres' }) code!: string;
  @IsString() @MinLength(8) @MaxLength(128) nouveau!: string;
}

class CodeDto {
  /** Pour une demande faite avec un email : identifiant du compte retrouvé. */
  @IsOptional() @IsString() @MaxLength(64) identifiant?: string;
}

@Controller()
export class MotDePasseController {
  constructor(private mdp: MotDePasseService) {}

  /** Mot de passe oublié : la demande part vers l'admin (notification, webhook). Réponse identique dans tous les cas. */
  @Public()
  @Post('auth/mot-de-passe-oublie')
  @HttpCode(200)
  async demander(@Body() d: DemandeDto, @EspaceCourant() espace: string) {
    await this.mdp.demander(d.identifiant, d.message, espace);
    return { ok: true };
  }

  /** Nouveau mot de passe avec le code donné par l'admin → connecté directement ({jeton}). */
  @Public()
  @Post('auth/reinitialiser')
  @HttpCode(200)
  reinitialiser(@Body() d: ReinitialiserDto, @EspaceCourant() espace: string) {
    return this.mdp.reinitialiser(d.identifiant, d.code, d.nouveau, espace);
  }

  @Roles(Role.ADMIN)
  @AutoriseCleApi()
  @Get('admin/mots-de-passe')
  lister() {
    return this.mdp.lister();
  }

  /** Code pour une demande (admin ou n8n avec une clé API) → {code, expire, identifiant, nom}. */
  @Roles(Role.ADMIN)
  @AutoriseCleApi()
  @Post('admin/mots-de-passe/:id/code')
  code(@Param('id') id: string, @Body() d: CodeDto) {
    return this.mdp.genererCode(id, d.identifiant);
  }

  @Roles(Role.ADMIN)
  @AutoriseCleApi()
  @Post('admin/mots-de-passe/:id/annuler')
  annuler(@Param('id') id: string) {
    return this.mdp.annuler(id);
  }
}
