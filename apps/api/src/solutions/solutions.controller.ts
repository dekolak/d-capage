import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { Moi, ModuleRequis, Principal, Roles } from '../auth/decorators';
import { MIME_IMAGE } from '../stockage/stockage.service';
import { SolutionsService } from './solutions.service';

class ChampsDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40) categorie?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(1000) cause?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(500) avertissement?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(40, { each: true }) motsCles?: string[];
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) guide?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) ecran?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(20) pastille?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) procedureId?: string | null;
  @IsOptional() @IsBoolean() publiee?: boolean;
  @IsOptional() @IsInt() @Min(0) ordre?: number;
}
class CreerDto extends ChampsDto {
  @IsString() @MinLength(3) @MaxLength(160) titre!: string;
  @IsString() @MinLength(2) @MaxLength(3000) texte!: string;
}
class ModifierDto extends ChampsDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(160) titre?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(3000) texte?: string;
}

const estAdmin = (m: Principal) => m.role === Role.ADMIN;

/** Astuces & solutions (module procedures-kiavik) : lecture. */
@ModuleRequis('procedures-kiavik')
@Controller('solutions')
export class SolutionsController {
  constructor(private solutions: SolutionsService) {}

  @Get()
  lister(@Moi() moi: Principal) {
    return this.solutions.lister(estAdmin(moi));
  }

  @Get(':id')
  lire(@Param('id') id: string, @Moi() moi: Principal) {
    return this.solutions.lire(id, estAdmin(moi));
  }

  @Get(':id/photo')
  async photo(@Param('id') id: string, @Moi() moi: Principal, @Res() res: Response) {
    const { flux, ext } = await this.solutions.lirePhoto(id, estAdmin(moi));
    res.setHeader('Content-Type', MIME_IMAGE[ext as keyof typeof MIME_IMAGE] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=604800');
    flux.pipe(res);
  }
}

/** Administration des fiches « Astuces & solutions ». */
@Roles(Role.ADMIN)
@Controller('admin/solutions')
export class AdminSolutionsController {
  constructor(private solutions: SolutionsService) {}

  @Post()
  creer(@Body() d: CreerDto) {
    return this.solutions.creer(d);
  }

  @Patch(':id')
  modifier(@Param('id') id: string, @Body() d: ModifierDto) {
    return this.solutions.modifier(id, d);
  }

  @Delete(':id')
  supprimer(@Param('id') id: string) {
    return this.solutions.supprimer(id);
  }

  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 8 * 1024 * 1024 } }))
  photo(@Param('id') id: string, @UploadedFile() f?: Express.Multer.File) {
    return this.solutions.photo(id, f);
  }

  @Delete(':id/photo')
  retirerPhoto(@Param('id') id: string) {
    return this.solutions.retirerPhoto(id);
  }
}
