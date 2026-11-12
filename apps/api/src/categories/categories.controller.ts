import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Roles } from '../auth/decorators';
import { CategoriesService, TypeElement } from './categories.service';

class CategorieDto {
  @IsString() @MinLength(2) @MaxLength(40) nom!: string;
  @IsOptional() @IsString() @MaxLength(16) icone?: string;
}
class ModifierCategorieDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40) nom?: string;
  @IsOptional() @IsString() @MaxLength(16) icone?: string;
  @IsOptional() @IsBoolean() masquee?: boolean;
}
class DeplacerDto {
  @IsIn([-1, 1]) sens!: -1 | 1;
}
class RefElementDto {
  @IsIn(['procedure', 'astuce', 'animation']) type!: TypeElement;
  @IsString() @MaxLength(80) id!: string;
  @IsOptional() @IsString() @MaxLength(40) guide?: string;
}
class RangerDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => RefElementDto) elements!: RefElementDto[];
  @IsString() @MinLength(2) @MaxLength(40) categorie!: string;
}

class OrdonnerDto {
  @IsIn(['procedure', 'astuce', 'animation']) type!: TypeElement;
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => RefElementDto) elements!: RefElementDto[];
}

/** Catégories de l'accueil Kiavik (ordre, icône, masquées) : lues par l'accueil. */
@Controller('categories')
export class CategoriesController {
  constructor(private categories: CategoriesService) {}

  @Get()
  lister() {
    return this.categories.lister();
  }
}

/** Administration → Accueil et catégories : tout le classement au même endroit. */
@Roles(Role.ADMIN)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private categories: CategoriesService) {}

  /** Procédures, diagnostics, astuces et animations, avec leur catégorie. */
  @Get('elements')
  elements() {
    return this.categories.elements();
  }

  @Post()
  creer(@Body() d: CategorieDto) {
    return this.categories.creer(d);
  }

  /** Ranger des éléments (un ou plusieurs) dans une catégorie. */
  @Post('ranger')
  ranger(@Body() d: RangerDto) {
    return this.categories.ranger(d.elements, d.categorie);
  }

  /** Ordre d'affichage dans une catégorie (un type à la fois : la liste complète, dans le nouvel ordre). */
  @Post('ordonner')
  ordonner(@Body() d: OrdonnerDto) {
    return this.categories.ordonner(d.type, d.elements);
  }

  @Patch(':id')
  modifier(@Param('id') id: string, @Body() d: ModifierCategorieDto) {
    return this.categories.modifier(id, d);
  }

  @Post(':id/deplacer')
  deplacer(@Param('id') id: string, @Body() d: DeplacerDto) {
    return this.categories.deplacer(id, d.sens);
  }

  /** `vers` : catégorie qui reçoit le contenu (obligatoire si elle n'est pas vide). */
  @Delete(':id')
  supprimer(@Param('id') id: string, @Query('vers') vers?: string) {
    return this.categories.supprimer(id, vers);
  }
}
