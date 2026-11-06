import { StatutAvis, Visibilite } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreerFicheDto {
  @IsString() userMachineId!: string;
  @IsString() @MinLength(1) @MaxLength(120) titre!: string;
  @IsOptional() @IsString() @MaxLength(4000) commentaire?: string;
  /** Valeurs saisies dans le miroir (validées par machine-kit). */
  @IsObject() valeurs!: Record<string, unknown>;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) tagIds?: string[];
  @IsOptional() @IsEnum(Visibilite) visibilite?: Visibilite;
  /** Note de l'auteur (1 à 5). */
  @IsOptional() @IsInt() @Min(1) @Max(5) note?: number;
  /** Accord pour que Lazzeko réutilise les photos de la fiche. */
  @IsOptional() @IsBoolean() accordPhotos?: boolean;
  /** Fiche d'origine en cas de duplication. */
  @IsOptional() @IsString() parentId?: string;
}

export class ModifierFicheDto {
  @IsOptional() @IsBoolean() accordPhotos?: boolean;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) titre?: string;
  @IsOptional() @IsString() @MaxLength(4000) commentaire?: string;
  @IsOptional() @IsObject() valeurs?: Record<string, unknown>;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) tagIds?: string[];
  @IsOptional() @IsEnum(Visibilite) visibilite?: Visibilite;
}

export class DemandeAideDto {
  @IsString() @MinLength(3) @MaxLength(2000) message!: string;
}

export class EvaluerDto {
  @IsInt() @Min(1) @Max(5) note!: number;
  @IsOptional() @IsString() @MaxLength(1000) avis?: string;
}

export class FiltresDto {
  @IsOptional() @IsString() varianteId?: string;
  @IsOptional() @IsString() modeleId?: string;
  @IsOptional() @IsString() userMachineId?: string;
  /** Ids de tags séparés par des virgules : la fiche doit les avoir tous. */
  @IsOptional() @IsString() tags?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsIn(['note', 'recent']) tri?: 'note' | 'recent';
  /** Note moyenne minimale (ex. 4 = 4 étoiles et plus ; les fiches non notées sont exclues). */
  @IsOptional() @Type(() => Number) @Min(1) @Max(5) noteMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) parPage?: number;
}

export class FiltresAdminDto extends FiltresDto {
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsIn(['oui', 'non']) masquee?: 'oui' | 'non';
  /** oui = seulement les fiches avec photos dont l'auteur a donné son accord. */
  @IsOptional() @IsIn(['oui']) photosUtilisables?: 'oui';
}

export class MasquerDto {
  @IsBoolean() masquee!: boolean;
  @IsOptional() @IsString() @MaxLength(300) raison?: string;
}

export class ModererAvisDto {
  @IsEnum(StatutAvis) statut!: StatutAvis;
  @IsOptional() @IsString() @MaxLength(300) raison?: string;
}

export class FiltresAvisDto {
  @IsOptional() @IsEnum(StatutAvis) statut?: StatutAvis;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() avecTexte?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) parPage?: number;
}

