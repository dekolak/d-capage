import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import type { Response } from 'express';
import { EspaceCourant, Moi, ModuleRequis, Principal, Roles } from '../auth/decorators';
import { espaceDeLaRequete } from '../espaces/espaces';
import { PrismaService } from '../prisma/prisma.service';
import { lecteur } from '../procedures/visibilite';
import { MIME_IMAGE } from '../stockage/stockage.service';
import { AcademieService } from './academie.service';

/** Module Académie de l'espace de la requête (academie-lazzeko ou academie-kiavik). */
export const moduleAcademie = (req: { headers: Record<string, string | string[] | undefined> }) =>
  espaceDeLaRequete(req).slug === 'lazzeko' ? 'academie-lazzeko' : 'academie-kiavik';
const estAdmin = (m: Principal) => m.role === Role.ADMIN;

class TermineeDto {
  @IsBoolean() terminee!: boolean;
}
class CreerCoursDto {
  @IsIn(['lazzeko', 'kiavik']) espace!: string;
  @IsOptional() @IsIn(['parcours', 'page']) type?: 'parcours' | 'page';
  @IsString() @MinLength(2) @MaxLength(150) titre!: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(1000) description?: string | null;
}
class ModifierCoursDto {
  @IsOptional() @IsIn(['lazzeko', 'kiavik']) espace?: string;
  @IsOptional() @IsIn(['parcours', 'page']) type?: 'parcours' | 'page';
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) titre?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(1000) description?: string | null;
  @IsOptional() @IsBoolean() publie?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(40, { each: true }) cibleCategories?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) cibleModeles?: string[];
}
class SensDto {
  @Type(() => Number) @IsIn([-1, 1]) sens!: -1 | 1;
}
class LeconDto {
  @IsString() @MinLength(1) @MaxLength(150) titre!: string;
  /** Blocs de la page (vérifiés par nettoyerBlocs). */
  @IsOptional() @IsArray() blocs?: unknown[];
}
class ModifierLeconDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150) titre?: string;
  @IsOptional() @IsArray() blocs?: unknown[];
}
class SimulateurDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) nom?: string;
  @IsOptional() @IsIn(['lazzeko', 'kiavik']) espace?: string;
  @IsOptional() @IsString() @MaxLength(40) modeleId?: string;
}

/** Académie côté client : cours, leçons, progression (module academie-<espace>). */
@ModuleRequis(moduleAcademie)
@Controller('academie')
export class AcademieController {
  constructor(private academie: AcademieService, private prisma: PrismaService) {}

  private qui(moi: Principal, espace: string) {
    return lecteur(this.prisma, { id: moi.id, admin: estAdmin(moi) }, espace);
  }

  @Get()
  async lister(@Moi() moi: Principal, @EspaceCourant() espace: string) {
    return this.academie.lister(espace, await this.qui(moi, espace), moi.id);
  }

  @Get('cours/:id')
  async cours(@Moi() moi: Principal, @Param('id') id: string, @EspaceCourant() espace: string) {
    return this.academie.cours(id, await this.qui(moi, espace), moi.id);
  }

  @Get('cours/:id/couverture')
  async couverture(@Param('id') id: string, @Res() res: Response) {
    const { flux, ext } = await this.academie.lireCouverture(id);
    res.setHeader('Content-Type', MIME_IMAGE[ext as keyof typeof MIME_IMAGE] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    flux.pipe(res);
  }

  @Get('lecons/:id')
  async lecon(@Moi() moi: Principal, @Param('id') id: string, @EspaceCourant() espace: string) {
    return this.academie.lecon(id, await this.qui(moi, espace), moi.id);
  }

  @Post('lecons/:id/terminee')
  @HttpCode(200)
  async terminee(@Moi() moi: Principal, @Param('id') id: string, @Body() d: TermineeDto, @EspaceCourant() espace: string) {
    return this.academie.terminer(id, await this.qui(moi, espace), moi.id, d.terminee);
  }

  /** HTML d'un simulateur, en JSON : l'app l'affiche dans une iframe isolée (jamais comme une page de l'app). */
  @Get('simulateurs/:id')
  simulateur(@Param('id') id: string) {
    return this.academie.htmlSimulateur(id);
  }

  @Get('fichiers/:id')
  async fichier(@Param('id') id: string, @Res() res: Response) {
    const { flux, type, nom } = await this.academie.lireFichier(id);
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nom)}"`);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    flux.pipe(res);
  }
}

/** Académie côté admin : cours, leçons (blocs), simulateurs, fichiers. */
@Roles(Role.ADMIN)
@Controller('admin/academie')
export class AdminAcademieController {
  constructor(private academie: AcademieService) {}

  @Get('cours')
  lister() {
    return this.academie.listerAdmin();
  }

  @Post('cours')
  creer(@Body() d: CreerCoursDto) {
    return this.academie.creerCours(d);
  }

  @Patch('cours/:id')
  modifier(@Param('id') id: string, @Body() d: ModifierCoursDto) {
    return this.academie.modifierCours(id, d);
  }

  @Delete('cours/:id')
  supprimer(@Param('id') id: string) {
    return this.academie.supprimerCours(id);
  }

  @Post('cours/:id/deplacer')
  @HttpCode(200)
  deplacer(@Param('id') id: string, @Body() d: SensDto) {
    return this.academie.deplacerCours(id, d.sens);
  }

  @Put('cours/:id/couverture')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 8 * 1024 * 1024 } }))
  couverture(@Param('id') id: string, @UploadedFile() f?: Express.Multer.File) {
    return this.academie.couverture(id, f);
  }

  @Delete('cours/:id/couverture')
  retirerCouverture(@Param('id') id: string) {
    return this.academie.couverture(id);
  }

  @Post('cours/:id/lecons')
  creerLecon(@Param('id') id: string, @Body() d: LeconDto) {
    return this.academie.creerLecon(id, d);
  }

  @Patch('lecons/:id')
  modifierLecon(@Param('id') id: string, @Body() d: ModifierLeconDto) {
    return this.academie.modifierLecon(id, d);
  }

  @Delete('lecons/:id')
  supprimerLecon(@Param('id') id: string) {
    return this.academie.supprimerLecon(id);
  }

  @Post('lecons/:id/deplacer')
  @HttpCode(200)
  deplacerLecon(@Param('id') id: string, @Body() d: SensDto) {
    return this.academie.deplacerLecon(id, d.sens);
  }

  @Get('simulateurs')
  simulateurs() {
    return this.academie.listerSimulateurs();
  }

  /** Nouveau simulateur : champ multipart « fichier » (.html), nom, espace, modeleId facultatif. */
  @Post('simulateurs')
  @UseInterceptors(FileInterceptor('fichier', { limits: { fileSize: 5 * 1024 * 1024 } }))
  creerSimulateur(@Body() d: SimulateurDto, @UploadedFile() f?: Express.Multer.File) {
    return this.academie.creerSimulateur({ nom: d.nom ?? f?.originalname ?? 'Simulateur', espace: d.espace ?? 'kiavik', modeleId: d.modeleId }, f);
  }

  /** Renommer, changer de modèle, ou remplacer le fichier (toutes les leçons qui l'utilisent sont à jour). */
  @Patch('simulateurs/:id')
  @UseInterceptors(FileInterceptor('fichier', { limits: { fileSize: 5 * 1024 * 1024 } }))
  modifierSimulateur(@Param('id') id: string, @Body() d: SimulateurDto, @UploadedFile() f?: Express.Multer.File) {
    return this.academie.modifierSimulateur(id, d, f);
  }

  @Delete('simulateurs/:id')
  supprimerSimulateur(@Param('id') id: string) {
    return this.academie.supprimerSimulateur(id);
  }

  /** Annotation d'une image (même annotateur que les pas-à-pas) : calque, original, image annotée. */
  @Get('fichiers/:id/calque')
  calque(@Param('id') id: string) {
    return this.academie.calque(id);
  }

  @Get('fichiers/:id/originale')
  async originale(@Param('id') id: string, @Res() res: Response) {
    const { flux, type } = await this.academie.lireOriginale(id);
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'no-store');
    flux.pipe(res);
  }

  /** Multipart « image » (image annotée) + « annotations » (JSON des formes). */
  @Post('fichiers/:id/annotation')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 12 * 1024 * 1024 } }))
  annoter(@Param('id') id: string, @Body('annotations') annotations: string, @UploadedFile() f?: Express.Multer.File) {
    let formes: unknown;
    try {
      formes = JSON.parse(annotations ?? '');
    } catch {
      throw new BadRequestException('Calque invalide');
    }
    return this.academie.annoter(id, formes, f);
  }

  @Delete('fichiers/:id/annotation')
  retirerAnnotation(@Param('id') id: string) {
    return this.academie.retirerAnnotation(id);
  }

  /** Image ou PDF d'un bloc (champ multipart « fichier »). */
  @Post('fichiers')
  @UseInterceptors(FileInterceptor('fichier', { limits: { fileSize: 15 * 1024 * 1024 } }))
  fichier(@UploadedFile() f?: Express.Multer.File) {
    return this.academie.envoyerFichier(f);
  }
}
