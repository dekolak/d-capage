import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AutoriseCleApi, ModuleRequis, Moi, Principal, Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { MachinesService } from './machines.service';

class AjouterMachineDto {
  @IsString() varianteId!: string;
  @IsOptional() @IsString() @MaxLength(60) surnom?: string;
}

class ModifierMachineDto {
  @IsOptional() @IsString() @MaxLength(60) surnom?: string;
}

/** Module « Réglages décapage » (espace Lazzeko). */
@ModuleRequis('reglages-decapage')
@Controller()
export class MachinesController {
  constructor(private machines: MachinesService, private prisma: PrismaService) {}

  // --- l'utilisateur gère lui-même ses machines ---
  @Get('moi/machines')
  mesMachines(@Moi() moi: Principal) {
    return this.machines.lister(moi.id);
  }

  @Post('moi/machines')
  ajouter(@Moi() moi: Principal, @Body() dto: AjouterMachineDto) {
    return this.machines.ajouter(moi.id, dto.varianteId, dto.surnom);
  }

  @Patch('moi/machines/:id')
  modifier(@Moi() moi: Principal, @Param('id') id: string, @Body() dto: ModifierMachineDto) {
    return this.machines.modifier(moi.id, id, dto.surnom);
  }

  @Delete('moi/machines/:id')
  retirer(@Moi() moi: Principal, @Param('id') id: string) {
    return this.machines.retirer(moi.id, id);
  }

  // --- l'admin (ou une clé API) attribue des machines à un client ---
  private async userExiste(id: string) {
    if (!(await this.prisma.user.findUnique({ where: { id } }))) throw new NotFoundException('Utilisateur introuvable');
  }

  @Get('users/:userId/machines')
  @Roles(Role.ADMIN)
  @AutoriseCleApi()
  async machinesDe(@Param('userId') userId: string) {
    await this.userExiste(userId);
    return this.machines.lister(userId);
  }

  @Post('users/:userId/machines')
  @Roles(Role.ADMIN)
  @AutoriseCleApi()
  async attribuer(@Param('userId') userId: string, @Body() dto: AjouterMachineDto) {
    await this.userExiste(userId);
    return this.machines.ajouter(userId, dto.varianteId, dto.surnom);
  }

  @Delete('users/:userId/machines/:id')
  @Roles(Role.ADMIN)
  retirerDe(@Param('userId') userId: string, @Param('id') id: string) {
    return this.machines.retirer(userId, id);
  }
}
