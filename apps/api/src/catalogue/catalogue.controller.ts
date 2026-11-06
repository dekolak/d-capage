import {
  BadRequestException, Controller, Delete, Get, NotFoundException, Param, Post, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { Public, Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { formatImage, MIME_IMAGE, StockageService } from '../stockage/stockage.service';
import { CatalogueService } from './catalogue.service';

type Cible = 'modeles' | 'variantes';

@Controller('catalogue')
export class CatalogueController {
  constructor(private catalogue: CatalogueService, private prisma: PrismaService, private stockage: StockageService) {}

  /** Fabricants → modèles → variantes (avec la dernière version d'interface et la miniature). */
  @Get()
  lister() {
    return this.catalogue.lister();
  }

  /** Config miroir complète d'une version. */
  @Get('versions/:id')
  version(@Param('id') id: string) {
    return this.catalogue.version(id);
  }

  // ---------- miniatures (image produit, publique) ----------
  private table(c: Cible) {
    return (c === 'modeles' ? this.prisma.modele : this.prisma.variante) as unknown as {
      findUnique(a: { where: { id: string } }): Promise<{ imageCle: string | null } | null>;
      update(a: { where: { id: string }; data: { imageCle: string | null; imageMaj: Date | null } }): Promise<unknown>;
    };
  }

  @Public()
  @Get('modeles/:id/image')
  imageModele(@Param('id') id: string, @Res() res: Response) {
    return this.image('modeles', id, res);
  }

  @Public()
  @Get('variantes/:id/image')
  imageVariante(@Param('id') id: string, @Res() res: Response) {
    return this.image('variantes', id, res);
  }

  /** Envoi de la miniature (champ « image ») : PNG de préférence, fond transparent ou clair. */
  @Post('modeles/:id/image')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
  envoyerModele(@Param('id') id: string, @UploadedFile() f?: Express.Multer.File) {
    return this.envoyer('modeles', id, f);
  }

  @Post('variantes/:id/image')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
  envoyerVariante(@Param('id') id: string, @UploadedFile() f?: Express.Multer.File) {
    return this.envoyer('variantes', id, f);
  }

  @Delete('modeles/:id/image')
  @Roles(Role.ADMIN)
  retirerModele(@Param('id') id: string) {
    return this.retirer('modeles', id);
  }

  @Delete('variantes/:id/image')
  @Roles(Role.ADMIN)
  retirerVariante(@Param('id') id: string) {
    return this.retirer('variantes', id);
  }

  private async image(cible: Cible, id: string, res: Response) {
    const e = await this.table(cible).findUnique({ where: { id } });
    const flux = e?.imageCle ? this.stockage.lire(e.imageCle) : null;
    if (!e?.imageCle || !flux) throw new NotFoundException();
    const ext = e.imageCle.split('.').pop() as keyof typeof MIME_IMAGE;
    res.setHeader('Content-Type', MIME_IMAGE[ext] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // l'URL change à chaque nouvel envoi (?v=)
    flux.pipe(res);
  }

  private async envoyer(cible: Cible, id: string, f?: Express.Multer.File) {
    const e = await this.table(cible).findUnique({ where: { id } });
    if (!e) throw new NotFoundException();
    if (!f) throw new BadRequestException('Image manquante');
    const fmt = formatImage(f.buffer);
    if (!fmt) throw new BadRequestException('Image PNG, JPEG ou WebP attendue');
    const cle = `catalogue/${cible}/${id}-${Date.now()}.${fmt}`;
    await this.stockage.ecrire(cle, f.buffer);
    if (e.imageCle) await this.stockage.supprimer(e.imageCle);
    await this.table(cible).update({ where: { id }, data: { imageCle: cle, imageMaj: new Date() } });
    return this.catalogue.lister();
  }

  private async retirer(cible: Cible, id: string) {
    const e = await this.table(cible).findUnique({ where: { id } });
    if (!e) throw new NotFoundException();
    if (e.imageCle) await this.stockage.supprimer(e.imageCle);
    await this.table(cible).update({ where: { id }, data: { imageCle: null, imageMaj: null } });
    return this.catalogue.lister();
  }
}
