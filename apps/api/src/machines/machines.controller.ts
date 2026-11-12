import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { AutoriseCleApi, EspaceCourant, Moi, Principal, Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { MachinesService } from './machines.service';

class AjouterMachineDto {
  @IsString() varianteId!: string;
  @IsOptional() @IsString() @MaxLength(60) surnom?: string;
  @IsOptional() @IsString() @MaxLength(60) numeroSerie?: string;
  @IsOptional() @Type(() => Date) @IsDate() miseEnService?: Date;
}

class ModifierMachineDto {
  @IsOptional() @IsString() @MaxLength(60) surnom?: string;
}

class ModifierMachineAdminDto extends ModifierMachineDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(60) numeroSerie?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Date) @IsDate() miseEnService?: Date | null;
}

/**
 * Machines des clients. C'est l'admin qui les ajoute (à la création du client, avec n° de série et mise en service) ;
 * le client les voit (Lazzeko : fiches de réglage ; Kiavik : carnet d'entretien) et peut leur donner un surnom.
 */
@Controller()
export class MachinesController {
  constructor(private machines: MachinesService, private prisma: PrismaService) {}

  /** Mes machines (celles visibles dans l'espace ouvert). */
  @Get('moi/machines')
  async mesMachines(@Moi() moi: Principal, @EspaceCourant() espace: string) {
    // Lazzeko : seulement les machines qui ont un écran de réglage (fiches)
    return (await this.machines.lister(moi.id)).filter((m) => m.espaces.includes(espace) && (espace !== 'lazzeko' || m.version));
  }

  @Patch('moi/machines/:id')
  modifier(@Moi() moi: Principal, @Param('id') id: string, @Body() dto: ModifierMachineDto) {
    return this.machines.modifier(moi.id, id, { surnom: dto.surnom });
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
    return this.machines.ajouter(userId, dto.varianteId, dto);
  }

  @Patch('users/:userId/machines/:id')
  @Roles(Role.ADMIN)
  @AutoriseCleApi()
  modifierDe(@Param('userId') userId: string, @Param('id') id: string, @Body() dto: ModifierMachineAdminDto) {
    return this.machines.modifier(userId, id, dto);
  }

  @Delete('users/:userId/machines/:id')
  @Roles(Role.ADMIN)
  retirerDe(@Param('userId') userId: string, @Param('id') id: string) {
    return this.machines.retirer(userId, id);
  }
}
