import { Body, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Post, Put, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { Moi, ModuleRequis, Principal, Public, Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { MIME_IMAGE } from '../stockage/stockage.service';
import { CorrectionsService } from './corrections.service';
import { GuidesService } from './guides.service';

class PastilleDto {
  @IsString() @MinLength(2) @MaxLength(120) titre!: string;
  @IsString() @MinLength(1) @MaxLength(2000) texte!: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(1000) conseil?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsIn(['astuce', 'avertissement', 'a_completer']) niveau?: 'astuce' | 'avertissement' | 'a_completer' | null;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(40, { each: true }) mots_cles?: string[];
}
class CategorieDto {
  @IsString() @MinLength(2) @MaxLength(40) categorie!: string;
}
class SousTitreDto {
  @IsString() @MinLength(2) @MaxLength(500) cap!: string;
}

/** Guides Kiavik (FlexiPRINT, DXonJet…) : chaque guide demande le module `guide-<slug>`. */
@Controller('guides')
export class GuidesController {
  constructor(private guides: GuidesService, private corrections: CorrectionsService, private prisma: PrismaService) {}

  /** Guides du compte (selon ses modules). */
  @Get()
  async lister(@Moi() moi: Principal) {
    const modules = moi.role === Role.ADMIN ? 'tous' : (await this.prisma.userModule.findMany({ where: { userId: moi.id }, select: { module: true } })).map((m) => m.module);
    // catégories des animations corrigées par l'admin
    const [cats, ordres] = await Promise.all([this.corrections.categoriesAnimations(), this.corrections.ordresAnimations()]);
    // ordre dans la catégorie de l'accueil : celui choisi par l'admin, sinon l'ordre du fichier (après)
    return this.guides.lister(modules).map((g, gi) => ({
      ...g,
      animations: g.animations
        .map((a, i) => ({ ...a, categorie: cats[g.slug]?.[a.id] ?? a.categorie, ordre: ordres[g.slug]?.[a.id] ?? 1000 + gi * 100 + i }))
        .sort((a, b) => a.ordre - b.ordre),
    }));
  }

  /** Captures du kit (publiques : chargées par des balises <img>, sans jeton). */
  @Public()
  @Get('images/*chemin')
  image(@Param('chemin') chemin: string | string[], @Res() res: Response) {
    const relatif = Array.isArray(chemin) ? chemin.join('/') : chemin;
    const fichier = this.guides.cheminImage(relatif);
    if (!fichier) throw new NotFoundException();
    res.sendFile(fichier, { maxAge: '7d' });
  }

  /** Photo remplacée par l'admin (publique comme les captures ; l'adresse change à chaque remplacement). */
  @Public()
  @Get('corrections/:id/photo')
  async photoCorrigee(@Param('id') id: string, @Res() res: Response) {
    const { flux, ext } = await this.corrections.lirePhoto(id);
    res.setHeader('Content-Type', MIME_IMAGE[ext as keyof typeof MIME_IMAGE] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    flux.pipe(res);
  }

  @ModuleRequis((req) => `guide-${req.params.slug}`)
  @Get(':slug')
  guide(@Param('slug') slug: string, @Moi() moi: Principal) {
    return this.corrections.guide(slug, moi.role === Role.ADMIN);
  }
}

/** Corrections des guides depuis l'app (admin) : fiches des boutons, sous-titres et photos des animations. */
@Roles(Role.ADMIN)
@Controller('admin/guides/:slug')
export class AdminGuidesController {
  constructor(private corrections: CorrectionsService) {}

  @Put('pastilles/:ecran/:pastille')
  corrigerPastille(@Param('slug') slug: string, @Param('ecran') ecran: string, @Param('pastille') pastille: string, @Body() d: PastilleDto) {
    return this.corrections.corrigerPastille(slug, ecran, pastille, d);
  }

  @Delete('pastilles/:ecran/:pastille')
  retirerPastille(@Param('slug') slug: string, @Param('ecran') ecran: string, @Param('pastille') pastille: string) {
    return this.corrections.retirer(slug, 'pastille', `${ecran}/${pastille}`);
  }

  @Put('animations/:anim/etapes/:scene/:etape')
  corrigerEtape(
    @Param('slug') slug: string, @Param('anim') anim: string,
    @Param('scene', ParseIntPipe) scene: number, @Param('etape', ParseIntPipe) etape: number, @Body() d: SousTitreDto,
  ) {
    return this.corrections.corrigerEtape(slug, anim, scene, etape, d.cap);
  }

  @Delete('animations/:anim/etapes/:scene/:etape')
  retirerEtape(@Param('slug') slug: string, @Param('anim') anim: string, @Param('scene') scene: string, @Param('etape') etape: string) {
    return this.corrections.retirer(slug, 'etape', `${anim}/${scene}/${etape}`);
  }

  /** Remplacer une photo d'animation (champ multipart « photo », compressée par le téléphone). */
  @Post('animations/:anim/photos/:photo')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 8 * 1024 * 1024 } }))
  remplacerPhoto(@Param('slug') slug: string, @Param('anim') anim: string, @Param('photo') photo: string, @UploadedFile() f?: Express.Multer.File) {
    return this.corrections.remplacerPhoto(slug, anim, photo, f);
  }

  /** Catégorie d'une animation sur l'accueil. */
  @Put('animations/:anim/categorie')
  categorie(@Param('slug') slug: string, @Param('anim') anim: string, @Body() d: CategorieDto) {
    return this.corrections.categorieAnimation(slug, anim, d.categorie);
  }

  @Delete('animations/:anim/categorie')
  retirerCategorie(@Param('slug') slug: string, @Param('anim') anim: string) {
    return this.corrections.retirer(slug, 'animation', anim);
  }

  @Delete('animations/:anim/photos/:photo')
  retirerPhoto(@Param('slug') slug: string, @Param('anim') anim: string, @Param('photo') photo: string) {
    return this.corrections.retirer(slug, 'photo', `${anim}/${photo}`);
  }
}
