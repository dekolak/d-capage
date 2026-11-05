import { Role } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreerUserDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9._@-]{3,64}$/, { message: 'identifiant : 3 à 64 caractères (lettres, chiffres, . _ @ -)' })
  identifiant!: string;

  @IsString() @MinLength(8) @MaxLength(128) motDePasse!: string;

  @IsOptional() @IsString() @MaxLength(120) nom?: string;

  @IsOptional() @IsEnum(Role) role?: Role;
}

export class ModifierUserDto {
  @IsOptional() @IsString() @MaxLength(120) nom?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsBoolean() actif?: boolean;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(128) motDePasse?: string;
}

export class ChangerMotDePasseDto {
  @IsString() @MinLength(1) ancien!: string;
  @IsString() @MinLength(8) @MaxLength(128) nouveau!: string;
}
