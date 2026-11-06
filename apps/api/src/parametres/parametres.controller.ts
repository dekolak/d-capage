import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsBoolean, IsOptional } from 'class-validator';
import { Roles } from '../auth/decorators';
import { ParametresService } from './parametres.service';

class ModifierParametresDto {
  @IsOptional() @IsBoolean() aideSupport?: boolean;
}

@Controller()
export class ParametresController {
  constructor(private parametres: ParametresService) {}

  /** Lu par l'app pour savoir quelles fonctions afficher. */
  @Get('parametres')
  lire() {
    return this.parametres.tous();
  }

  @Patch('admin/parametres')
  @Roles(Role.ADMIN)
  modifier(@Body() dto: ModifierParametresDto) {
    return this.parametres.modifier(dto);
  }
}
