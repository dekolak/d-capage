import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { AutoriseCleApi, EspaceCourant, Moi, Principal, Roles } from '../auth/decorators';
import { MIME_IMAGE } from '../stockage/stockage.service';
import { EntretienService, PHOTOS, UNITES } from './entretien.service';

class PlanDto {
  @IsString() @MinLength(2) @MaxLength(80) nom!: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(1000) description?: string | null;
}
class ModifierPlanDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) nom?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(1000) description?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) modeleIds?: string[];
}
class ModifierTacheDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) titre?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(1000) description?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(1000) frequence?: number;
  @IsOptional() @IsIn(UNITES as unknown as string[]) unite?: string;
  @IsOptional() @IsInt() @Min(0) @Max(365) bientotJours?: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) procedureId?: string | null;
  @IsOptional() @IsIn(PHOTOS as unknown as string[]) photo?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(200) photoConsigne?: string | null;
  @IsOptional() @IsBoolean() technicien?: boolean;
}
class TacheDto extends ModifierTacheDto {
  @IsString() @MinLength(2) @MaxLength(120) declare titre: string;
}
class DeplacerDto {
  @IsIn([-1, 1]) sens!: -1 | 1;
}
/** Envoyé en multipart (photo facultative) : les champs arrivent en texte. */
class FaitDto {
  @IsOptional() @IsString() @MaxLength(40) tacheId?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
  @IsOptional() @IsString() @MaxLength(120) titre?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @IsOptional() @IsIn(['client', 'pasapas']) source?: string;
}
class SuiviQuery {
  @IsOptional() @IsString() etat?: string;
  @IsOptional() @IsString() modeleId?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

const PHOTO = FileInterceptor('photo', { limits: { fileSize: 8 * 1024 * 1024 } });
const etats = (s?: string) => (s ? s.split(',').map((x) => x.trim()).filter((x) => ['retard', 'bientot', 'ok'].includes(x)) : undefined);
const estAdmin = (m: Principal) => m.role === Role.ADMIN;

/** Carnet d'entretien côté client : ses machines (selon l'espace), noter une tâche faite ou une note, photo. */
@Controller()
export class CarnetController {
  constructor(private entretien: EntretienService) {}

  @Get('moi/carnet')
  mesCarnets(@Moi() moi: Principal, @EspaceCourant() espace: string) {
    return this.entretien.mesCarnets(moi.id, espace);
  }

  @Get('moi/carnet/:id')
  carnet(@Moi() moi: Principal, @Param('id') id: string) {
    return this.entretien.carnet(id, estAdmin(moi) ? undefined : moi.id);
  }

  @Post('moi/carnet/:id/faits')
  @UseInterceptors(PHOTO)
  noter(@Moi() moi: Principal, @Param('id') id: string, @Body() d: FaitDto, @UploadedFile() photo?: Express.Multer.File) {
    return this.entretien.noter(id, { id: moi.id, admin: false }, d, photo);
  }

  @Delete('moi/carnet/faits/:id')
  retirer(@Moi() moi: Principal, @Param('id') id: string) {
    return this.entretien.retirer(id, { id: moi.id, admin: estAdmin(moi) });
  }

  @Get('carnet/photos/:id')
  async photo(@Moi() moi: Principal, @Param('id') id: string, @Res() res: Response) {
    const { flux, ext } = await this.entretien.lirePhoto(id, { id: moi.id, admin: estAdmin(moi) });
    res.setHeader('Content-Type', MIME_IMAGE[ext as keyof typeof MIME_IMAGE] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    flux.pipe(res);
  }
}

/** Administration → Entretien : plans, tâches, modèles, suivi des machines, interventions ; échéances pour n8n (clé API). */
@Roles(Role.ADMIN)
@Controller('admin/entretien')
export class AdminEntretienController {
  constructor(private entretien: EntretienService) {}

  @Get('plans')
  plans() {
    return this.entretien.listerPlans();
  }

  @Post('plans')
  async creerPlan(@Body() d: PlanDto) {
    await this.entretien.creerPlan(d);
    return this.entretien.listerPlans();
  }

  @Patch('plans/:id')
  modifierPlan(@Param('id') id: string, @Body() d: ModifierPlanDto) {
    return this.entretien.modifierPlan(id, d);
  }

  @Delete('plans/:id')
  supprimerPlan(@Param('id') id: string) {
    return this.entretien.supprimerPlan(id);
  }

  @Post('plans/:id/taches')
  ajouterTache(@Param('id') id: string, @Body() d: TacheDto) {
    return this.entretien.ajouterTache(id, d);
  }

  @Patch('taches/:id')
  modifierTache(@Param('id') id: string, @Body() d: ModifierTacheDto) {
    return this.entretien.modifierTache(id, d);
  }

  @Post('taches/:id/deplacer')
  deplacerTache(@Param('id') id: string, @Body() d: DeplacerDto) {
    return this.entretien.deplacerTache(id, d.sens);
  }

  @Delete('taches/:id')
  supprimerTache(@Param('id') id: string) {
    return this.entretien.supprimerTache(id);
  }

  /** Machines suivies : ?etat=retard,bientot&modeleId=…&q=… */
  @Get('machines')
  @AutoriseCleApi()
  suivi(@Query() f: SuiviQuery) {
    return this.entretien.suivi({ etat: etats(f.etat), modeleId: f.modeleId, q: f.q });
  }

  @Get('machines/:id')
  @AutoriseCleApi()
  carnet(@Param('id') id: string) {
    return this.entretien.carnet(id);
  }

  /** Intervention Kiavik / Lazzeko notée par l'admin (toute tâche, photo facultative). */
  @Post('machines/:id/faits')
  @UseInterceptors(PHOTO)
  noter(@Moi() moi: Principal, @Param('id') id: string, @Body() d: FaitDto, @UploadedFile() photo?: Express.Multer.File) {
    return this.entretien.noter(id, { id: moi.id, admin: true }, d, photo);
  }

  @Delete('faits/:id')
  retirer(@Moi() moi: Principal, @Param('id') id: string) {
    return this.entretien.retirer(id, { id: moi.id, admin: true });
  }

  /**
   * Pour n8n (clé API) : une ligne par tâche à rappeler, avec le client (n° Odoo), la machine et les liens.
   * ?etat=retard,bientot (par défaut).
   */
  @Get('echeances')
  @AutoriseCleApi()
  echeances(@Query('etat') etat?: string) {
    return this.entretien.echeances(etats(etat) ?? ['retard', 'bientot']);
  }
}

