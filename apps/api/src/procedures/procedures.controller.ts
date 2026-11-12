import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { AutoriseCleApi, Moi, ModuleRequis, Principal, Roles } from '../auth/decorators';
import { MIME_IMAGE } from '../stockage/stockage.service';
import { SUITES } from './chemin';
import { DiagnosticsService } from './diagnostics.service';
import { SuiviService } from './suivi.service';
import { ProceduresService } from './procedures.service';

class ProcedureDto {
  @IsString() @MinLength(2) @MaxLength(120) titre!: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40) categorie?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(400) resume?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(5000) description?: string | null;
}
class ModifierProcedureDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(5000) description?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(5000) prompt?: string | null;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) titre?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40) categorie?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(400) resume?: string | null;
  @IsOptional() @IsBoolean() publiee?: boolean;
  @IsOptional() @IsInt() @Min(0) ordre?: number;
  /** Procédure proposée à la fin ; null pour aucune. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) suivanteId?: string | null;
}
class LienEtapeDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) guide?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) ecran?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(20) pastille?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(500) avertissement?: string | null;
  @IsOptional() @IsBoolean() controle?: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) solutionId?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(2000) note?: string | null;
}
class EtapeDto extends LienEtapeDto {
  @IsString() @MinLength(2) @MaxLength(2000) texte!: string;
  /** Place de la nouvelle étape (0 = en premier) ; à la fin si absent. */
  @IsOptional() @IsInt() @Min(0) position?: number;
  /** Détour : id de la réponse dont l'étape fait partie ; absent = route principale. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) brancheId?: string | null;
}
class NouveauChoixDto {
  @IsString() @MinLength(1) @MaxLength(120) libelle!: string;
}
class ChoixDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) libelle?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(1000) signification?: string | null;
  @IsOptional() @IsIn(SUITES) suite?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) etapeCibleId?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(2000) conclusion?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) solutionId?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) procedureCibleId?: string | null;
}
class EnvoiDiagnosticDto {
  /** Réponses : id de la question → id de la réponse. */
  @IsObject() reponses!: Record<string, string>;
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
}
class SignalerDto {
  @IsOptional() @IsString() @MaxLength(1000) message?: string;
}
class SuiviDto {
  @IsString() @MinLength(8) @MaxLength(64) session!: string;
  @IsObject() reponses!: Record<string, string>;
  @IsInt() @Min(0) faites!: number;
  @IsInt() @Min(0) total!: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) derniere?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsIn(['termine', 'resolu', 'contact']) fin?: string | null;
}
class TermineDto {
  @IsString() @MaxLength(40) annonceId!: string;
}
class TraiteDto {
  @IsBoolean() traite!: boolean;
}
class PromptDto {
  @IsString() @MaxLength(10000) texte!: string;
}
class LuDto {
  @IsBoolean() lu!: boolean;
}
class ModifierEtapeDto extends LienEtapeDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(2000) texte?: string;
}
class DeplacerDto {
  @IsIn([-1, 1]) sens!: -1 | 1;
}

const estAdmin = (m: Principal) => m.role === Role.ADMIN;

/** Procédures Kiavik (module procedures-kiavik) : lecture. */
@ModuleRequis('procedures-kiavik')
@Controller('procedures')
export class ProceduresController {
  constructor(private procedures: ProceduresService, private diagnostics: DiagnosticsService, private suivi: SuiviService) {}

  /** « Pas clair ? » sur une étape : les admins sont prévenus. */
  @Post('etapes/:id/signaler')
  signaler(@Param('id') id: string, @Body() d: SignalerDto, @Moi() moi: Principal) {
    return this.suivi.signaler(id, { id: moi.id, admin: estAdmin(moi) }, d.message);
  }

  /** Pas-à-pas terminé, ouvert depuis un rappel d'entretien (message) : gardé pour l'historique du client. */
  @Post(':id/termine')
  termine(@Param('id') id: string, @Body() d: TermineDto, @Moi() moi: Principal) {
    return this.suivi.termineDepuisRappel(id, moi.id, d.annonceId);
  }

  /** Avancement anonyme d'une tentative (statistiques). */
  @Put(':id/suivi')
  suivre(@Param('id') id: string, @Body() d: SuiviDto, @Moi() moi: Principal) {
    const reponses = Object.fromEntries(Object.entries(d.reponses).filter(([, v]) => typeof v === 'string').slice(0, 300));
    return this.suivi.suivre(id, estAdmin(moi), { ...d, reponses });
  }

  /** Le client envoie le résultat d'un diagnostic (ses réponses) : admins prévenus, webhook `diagnostic.envoye`. */
  @Post(':id/diagnostic')
  envoyer(@Param('id') id: string, @Body() d: EnvoiDiagnosticDto, @Moi() moi: Principal) {
    const reponses = Object.fromEntries(Object.entries(d.reponses).filter(([k, v]) => typeof k === 'string' && typeof v === 'string').slice(0, 300));
    return this.diagnostics.envoyer(id, { id: moi.id, admin: estAdmin(moi) }, reponses, d.message);
  }

  @Get()
  lister(@Moi() moi: Principal) {
    return this.procedures.lister(estAdmin(moi));
  }

  /** Diagnostics envoyés par le client connecté. */
  @Get('diagnostics/miens')
  mesDiagnostics(@Moi() moi: Principal) {
    return this.diagnostics.miens(moi.id);
  }

  @Get(':id')
  lire(@Param('id') id: string, @Moi() moi: Principal) {
    return this.procedures.lire(id, estAdmin(moi));
  }

  /** Une photo d'étape (adresse fixe : une photo n'est jamais modifiée). */
  @Get('photos/:id')
  async photo(@Param('id') id: string, @Moi() moi: Principal, @Res() res: Response) {
    const { flux, ext } = await this.procedures.lirePhoto({ id }, estAdmin(moi));
    res.setHeader('Content-Type', MIME_IMAGE[ext as keyof typeof MIME_IMAGE] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=2592000');
    flux.pipe(res);
  }

  /** Première photo d'une étape (anciennes adresses). */
  @Get('etapes/:id/photo')
  async premierePhoto(@Param('id') id: string, @Moi() moi: Principal, @Res() res: Response) {
    const { flux, ext } = await this.procedures.lirePhoto({ etapeId: id }, estAdmin(moi));
    res.setHeader('Content-Type', MIME_IMAGE[ext as keyof typeof MIME_IMAGE] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    flux.pipe(res);
  }
}

/** Administration des procédures (création, étapes, photos, publication). */
@Roles(Role.ADMIN)
@Controller('admin/procedures')
export class AdminProceduresController {
  constructor(private procedures: ProceduresService, private suivi: SuiviService) {}

  /** Signalements « pas clair » ouverts, par procédure. */
  @Get('signalements/ouverts')
  signalementsOuverts() {
    return this.suivi.ouvertsParProcedure();
  }

  @Patch('signalements/:id')
  traiter(@Param('id') id: string, @Body() d: TraiteDto) {
    return this.suivi.traiter(id, d.traite);
  }

  @Get(':id/signalements')
  signalements(@Param('id') id: string) {
    return this.suivi.signalements(id);
  }

  @Get(':id/stats')
  stats(@Param('id') id: string) {
    return this.suivi.stats(id);
  }

  @Post()
  creer(@Body() d: ProcedureDto) {
    return this.procedures.creer(d);
  }

  /** Copie complète (brouillon) : étapes, questions, détours, photos. */
  @Post(':id/dupliquer')
  dupliquer(@Param('id') id: string) {
    return this.procedures.dupliquer(id);
  }

  @Patch(':id')
  modifier(@Param('id') id: string, @Body() d: ModifierProcedureDto) {
    return this.procedures.modifier(id, d);
  }

  @Delete(':id')
  supprimer(@Param('id') id: string) {
    return this.procedures.supprimer(id);
  }

  @Post(':id/etapes')
  ajouterEtape(@Param('id') id: string, @Body() d: EtapeDto) {
    return this.procedures.ajouterEtape(id, d);
  }

  @Patch('etapes/:id')
  modifierEtape(@Param('id') id: string, @Body() d: ModifierEtapeDto) {
    return this.procedures.modifierEtape(id, d);
  }

  @Post('etapes/:id/deplacer')
  deplacer(@Param('id') id: string, @Body() d: DeplacerDto) {
    return this.procedures.deplacerEtape(id, d.sens);
  }

  @Delete('etapes/:id')
  supprimerEtape(@Param('id') id: string) {
    return this.procedures.supprimerEtape(id);
  }

  /** Ajoute une photo à l'étape (champ multipart « photo », compressée par le téléphone ; 8 au plus). */
  @Post('etapes/:id/photo')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 8 * 1024 * 1024 } }))
  photo(@Param('id') id: string, @UploadedFile() f?: Express.Multer.File) {
    return this.procedures.photo(id, f);
  }

  /** Retire toutes les photos de l'étape. */
  @Delete('etapes/:id/photo')
  retirerPhotos(@Param('id') id: string) {
    return this.procedures.retirerPhotos(id);
  }

  @Delete('photos/:id')
  retirerPhoto(@Param('id') id: string) {
    return this.procedures.retirerPhoto(id);
  }

  @Post('photos/:id/deplacer')
  deplacerPhoto(@Param('id') id: string, @Body() d: DeplacerDto) {
    return this.procedures.deplacerPhoto(id, d.sens);
  }

  // réponses d'une question
  @Post('etapes/:id/choix')
  ajouterChoix(@Param('id') id: string, @Body() d: NouveauChoixDto) {
    return this.procedures.ajouterChoix(id, d.libelle.trim());
  }

  @Patch('choix/:id')
  modifierChoix(@Param('id') id: string, @Body() d: ChoixDto) {
    return this.procedures.modifierChoix(id, d);
  }

  @Post('choix/:id/deplacer')
  deplacerChoix(@Param('id') id: string, @Body() d: DeplacerDto) {
    return this.procedures.deplacerChoix(id, d.sens);
  }

  @Delete('choix/:id')
  supprimerChoix(@Param('id') id: string) {
    return this.procedures.supprimerChoix(id);
  }
}

/** Diagnostics reçus des clients (admin, ou n8n avec une clé API). */
@Roles(Role.ADMIN)
@AutoriseCleApi()
@Controller('admin/diagnostics')
export class AdminDiagnosticsController {
  constructor(private diagnostics: DiagnosticsService) {}

  @Get()
  lister(@Query('nonLus') nonLus?: string) {
    return this.diagnostics.lister(nonLus === '1' || nonLus === 'true');
  }

  /** Texte prêt à coller dans une IA : prompts, résumé de la procédure, réponses et message du client. */
  @Get(':id/paquet')
  paquet(@Param('id') id: string) {
    return this.diagnostics.paquetDiagnostic(id);
  }

  @Patch(':id')
  marquer(@Param('id') id: string, @Body() d: LuDto) {
    return this.diagnostics.marquer(id, d.lu);
  }
}

/**
 * Préparation pour l'IA (admin, ou n8n avec une clé API) : catalogue des procédures, export de l'arbre d'une procédure,
 * prompt général de l'espace.
 */
@Roles(Role.ADMIN)
@AutoriseCleApi()
@Controller('ia')
export class IaController {
  constructor(private diagnostics: DiagnosticsService) {}

  @Get('catalogue')
  catalogue() {
    return this.diagnostics.catalogue();
  }

  @Get('procedures/:id')
  exporter(@Param('id') id: string) {
    return this.diagnostics.exporter(id);
  }

  @Get('prompt')
  async prompt() {
    return { texte: await this.diagnostics.promptGeneral() };
  }

  @Put('prompt')
  definirPrompt(@Body() d: PromptDto) {
    return this.diagnostics.definirPromptGeneral(d.texte);
  }
}
