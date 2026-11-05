import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Moi, Principal, Roles } from '../auth/decorators';
import { ApiKeysService } from './api-keys.service';

class CreerCleDto {
  @IsString() @MinLength(1) @MaxLength(80) nom!: string;
}

/** Gestion des clés API : admin connecté uniquement (une clé ne peut pas créer de clé). */
@Controller('admin/cles-api')
@Roles(Role.ADMIN)
export class ApiKeysController {
  constructor(private cles: ApiKeysService) {}

  @Post()
  creer(@Body() dto: CreerCleDto, @Moi() moi: Principal) {
    return this.cles.creer(dto.nom, moi.id);
  }

  @Get()
  lister() {
    return this.cles.lister();
  }

  @Delete(':id')
  revoquer(@Param('id') id: string) {
    return this.cles.revoquer(id);
  }
}
