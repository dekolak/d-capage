import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { Moi, ModuleRequis, Principal, Roles } from '../auth/decorators';
import { MIME_IMAGE } from '../stockage/stockage.service';
import { ProceduresService } from './procedures.service';

class ProcedureDto {
  @IsString() @MinLength(2) @MaxLength(120) titre!: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40) categorie?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(400) resume?: string | null;
}
class ModifierProcedureDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) titre?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40) categorie?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(400) resume?: string | null;
  @IsOptional() @IsBoolean() publiee?: boolean;
  @IsOptional() @IsInt() @Min(0) ordre?: number;
}
class LienEtapeDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) guide?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) ecran?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(20) pastille?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(500) avertissement?: string | null;
}
class EtapeDto extends LienEtapeDto {
  @IsString() @MinLength(2) @MaxLength(2000) texte!: string;
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
  constructor(private procedures: ProceduresService) {}

  @Get()
  lister(@Moi() moi: Principal) {
    return this.procedures.lister(estAdmin(moi));
  }

  @Get(':id')
  lire(@Param('id') id: string, @Moi() moi: Principal) {
    return this.procedures.lire(id, estAdmin(moi));
  }

  @Get('etapes/:id/photo')
  async photo(@Param('id') id: string, @Moi() moi: Principal, @Res() res: Response) {
    const { flux, ext } = await this.procedures.lirePhoto(id, estAdmin(moi));
    res.setHeader('Content-Type', MIME_IMAGE[ext as keyof typeof MIME_IMAGE] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=604800'); // l'adresse change à chaque nouvelle photo (?v=)
    flux.pipe(res);
  }
}

/** Administration des procédures (création, étapes, photos, publication). */
@Roles(Role.ADMIN)
@Controller('admin/procedures')
export class AdminProceduresController {
  constructor(private procedures: ProceduresService) {}

  @Post()
  creer(@Body() d: ProcedureDto) {
    return this.procedures.creer(d);
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

  /** Photo d'une étape (champ multipart « photo », compressée par le téléphone). */
  @Post('etapes/:id/photo')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 8 * 1024 * 1024 } }))
  photo(@Param('id') id: string, @UploadedFile() f?: Express.Multer.File) {
    return this.procedures.photo(id, f);
  }

  @Delete('etapes/:id/photo')
  retirerPhoto(@Param('id') id: string) {
    return this.procedures.retirerPhoto(id);
  }
}
