import { Body, Controller, ForbiddenException, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AutoriseCleApi, Moi, Principal, Roles } from '../auth/decorators';
import { ChangerMotDePasseDto, CreerUserDto, ModifierUserDto } from './users.dto';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private users: UsersService) {}

  /** Création d'un compte : admin connecté ou clé API (X-Api-Key). */
  @Post('users')
  @Roles(Role.ADMIN)
  @AutoriseCleApi()
  creer(@Body() dto: CreerUserDto, @Moi() moi: Principal) {
    if (moi.type === 'cleApi' && dto.role === Role.ADMIN)
      throw new ForbiddenException('Une clé API ne peut pas créer d\'admin');
    return this.users.creer(dto);
  }

  @Get('users')
  @Roles(Role.ADMIN)
  lister() {
    return this.users.lister();
  }

  @Get('users/:id')
  @Roles(Role.ADMIN)
  trouver(@Param('id') id: string) {
    return this.users.trouver(id);
  }

  @Patch('users/:id')
  @Roles(Role.ADMIN)
  modifier(@Param('id') id: string, @Body() dto: ModifierUserDto) {
    return this.users.modifier(id, dto);
  }

  @Get('moi')
  moi(@Moi() moi: Principal) {
    return this.users.trouver(moi.id);
  }

  @Post('moi/mot-de-passe')
  changerMotDePasse(@Moi() moi: Principal, @Body() dto: ChangerMotDePasseDto) {
    return this.users.changerMotDePasse(moi.id, dto.ancien, dto.nouveau);
  }
}
