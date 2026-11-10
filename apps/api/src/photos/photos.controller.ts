import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Role, TypePhoto } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ModuleRequis, Moi, Principal } from '../auth/decorators';
import { FichesService } from '../fiches/fiches.service';
import { PrismaService } from '../prisma/prisma.service';
import { formatImage, MIME_IMAGE as MIME, StockageService } from '../stockage/stockage.service';

const MAX_PHOTOS = 12;
const MAX_OCTETS = 8 * 1024 * 1024;

class AjouterPhotoDto {
  @IsEnum(TypePhoto) type!: TypePhoto;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) ordre?: number;
}

class ModifierPhotoDto {
  @IsOptional() @IsEnum(TypePhoto) type?: TypePhoto;
  @IsOptional() @IsInt() @Min(0) ordre?: number;
}



/** Module « Réglages décapage » (espace Lazzeko). */
@ModuleRequis('reglages-decapage')
@Controller()
export class PhotosController {
  constructor(private prisma: PrismaService, private fiches: FichesService, private stockage: StockageService) {}

  /**
   * Envoi multipart : `fichier` (image compressée côté téléphone), `miniature` (facultative), `type`.
   */
  @Post('fiches/:id/photos')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'fichier', maxCount: 1 }, { name: 'miniature', maxCount: 1 }], {
      limits: { fileSize: MAX_OCTETS },
    }),
  )
  async ajouter(
    @Moi() moi: Principal,
    @Param('id') ficheId: string,
    @Body() dto: AjouterPhotoDto,
    @UploadedFiles() fichiers: { fichier?: Express.Multer.File[]; miniature?: Express.Multer.File[] },
  ) {
    const f = await this.prisma.fiche.findUnique({ where: { id: ficheId }, include: { _count: { select: { photos: true } } } });
    if (!f) throw new NotFoundException('Fiche introuvable');
    if (f.userId !== moi.id) throw new ForbiddenException();
    if (f._count.photos >= MAX_PHOTOS) throw new BadRequestException(`${MAX_PHOTOS} photos maximum par fiche`);

    const img = fichiers?.fichier?.[0];
    if (!img) throw new BadRequestException('Fichier manquant');
    const fmt = formatImage(img.buffer);
    if (!fmt) throw new BadRequestException('Image JPEG, PNG ou WebP attendue');
    const min = fichiers.miniature?.[0];
    const fmtMin = min ? formatImage(min.buffer) : null;
    if (min && !fmtMin) throw new BadRequestException('Miniature invalide');

    const id = randomUUID();
    const cle = `fiches/${ficheId}/${id}.${fmt}`;
    const cleMin = min ? `fiches/${ficheId}/${id}_min.${fmtMin}` : null;
    await this.stockage.ecrire(cle, img.buffer);
    if (min && cleMin) await this.stockage.ecrire(cleMin, min.buffer);

    return this.prisma.photo.create({
      data: { ficheId, type: dto.type, cle, miniature: cleMin, ordre: dto.ordre ?? f._count.photos },
      select: { id: true, type: true, ordre: true },
    });
  }

  private async photoVisible(id: string, moi: Principal) {
    const p = await this.prisma.photo.findUnique({ where: { id }, include: { fiche: { select: { userId: true, visibilite: true, masquee: true } } } });
    if (!p || !this.fiches.peutVoir(p.fiche, moi)) throw new NotFoundException();
    return p;
  }

  @Get('photos/:id')
  async lire(@Moi() moi: Principal, @Param('id') id: string, @Query('taille') taille: string, @Res() res: Response) {
    const p = await this.photoVisible(id, moi);
    const cle = taille === 'min' && p.miniature ? p.miniature : p.cle;
    const flux = this.stockage.lire(cle);
    if (!flux) throw new NotFoundException();
    const ext = cle.split('.').pop() as keyof typeof MIME;
    res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    flux.pipe(res);
  }

  private async photoAMoi(id: string, moi: Principal) {
    const p = await this.prisma.photo.findUnique({ where: { id }, include: { fiche: { select: { userId: true } } } });
    if (!p) throw new NotFoundException();
    if (p.fiche.userId !== moi.id && moi.role !== Role.ADMIN) throw new ForbiddenException();
    return p;
  }

  @Patch('photos/:id')
  async modifier(@Moi() moi: Principal, @Param('id') id: string, @Body() dto: ModifierPhotoDto) {
    await this.photoAMoi(id, moi);
    return this.prisma.photo.update({ where: { id }, data: dto, select: { id: true, type: true, ordre: true } });
  }

  @Delete('photos/:id')
  async supprimer(@Moi() moi: Principal, @Param('id') id: string) {
    const p = await this.photoAMoi(id, moi);
    await this.prisma.photo.delete({ where: { id } });
    await this.stockage.supprimer(p.cle);
    if (p.miniature) await this.stockage.supprimer(p.miniature);
    return { ok: true };
  }
}
