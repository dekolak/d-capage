import { Role } from '@prisma/client';
import { ESPACES, TOUS_MODULES } from '../espaces/espaces';
import { LANGUES } from '../langues';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export class CreerUserDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9._@-]{3,64}$/, { message: 'identifiant : 3 à 64 caractères (lettres, chiffres, . _ @ -)' })
  identifiant!: string;

  @IsString() @MinLength(8) @MaxLength(128) motDePasse!: string;

  @IsOptional() @IsString() @MaxLength(120) nom?: string;

  @IsOptional() @IsEnum(Role) role?: Role;

  /** Client Lazzeko (par défaut) ou utilisateur d'une autre marque. */
  @IsOptional() @IsBoolean() clientLazzeko?: boolean;

  /** N° de client dans Odoo (facultatif). */
  @IsOptional() @IsString() @MaxLength(40) numeroOdoo?: string;

  /** Modules accessibles (donnent l'accès aux espaces). Absent : ["reglages-decapage"]. */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsIn(TOUS_MODULES, { each: true }) modules?: string[];

  /** Langue de l'app (fr, en…) ; absente = langue du téléphone. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsIn(LANGUES, { message: `langue : ${LANGUES.join(', ')}` }) langue?: string | null;
}

export class ModifierUserDto {
  @IsOptional() @IsString() @MaxLength(120) nom?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsBoolean() actif?: boolean;
  @IsOptional() @IsBoolean() clientLazzeko?: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(40) numeroOdoo?: string | null;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(128) motDePasse?: string;
  /** Remplace la liste des modules. */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsIn(TOUS_MODULES, { each: true }) modules?: string[];
  /** Langue de l'app (null = langue du téléphone). */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsIn(LANGUES, { message: `langue : ${LANGUES.join(', ')}` }) langue?: string | null;
}

export class AccepterConditionsDto {
  /** Espace dont on accepte les conditions (par défaut : l'espace courant). */
  @IsOptional() @IsIn(ESPACES.map((e) => e.slug)) espace?: string;
  @IsInt() @Min(1) version!: number;
  @IsOptional() @IsBoolean() accordPhotosMarketing?: boolean;
}

export class PreferencesDto {
  @IsOptional() @IsBoolean() accordPhotosMarketing?: boolean;
  /** Langue de l'app (null = langue du téléphone). */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsIn(LANGUES, { message: `langue : ${LANGUES.join(', ')}` }) langue?: string | null;
}

export class ChangerMotDePasseDto {
  @IsString() @MinLength(1) ancien!: string;
  @IsString() @MinLength(8) @MaxLength(128) nouveau!: string;
}
