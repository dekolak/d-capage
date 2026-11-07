import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AutoriseCleApi, Moi, Principal, Roles, SansConditions } from '../auth/decorators';
import { ParametresService } from '../parametres/parametres.service';
import { AccepterConditionsDto, ChangerMotDePasseDto, CreerUserDto, ModifierUserDto, PreferencesDto } from './users.dto';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private users: UsersService, private parametres: ParametresService) {}

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
  @AutoriseCleApi()
  /** ?numeroOdoo=… pour retrouver un compte depuis Odoo ; ?q=… recherche libre. */
  lister(@Query('numeroOdoo') numeroOdoo?: string, @Query('q') q?: string) {
    return this.users.lister({ numeroOdoo, q });
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
  @SansConditions()
  async moi(@Moi() moi: Principal) {
    const u = await this.users.trouver(moi.id);
    const courante = await this.parametres.versionConditions();
    return { ...u, conditionsAJour: u.role === 'ADMIN' || (u.conditionsVersion ?? 0) >= courante };
  }

  /** Accepter les conditions (partage communautaire) + accord facultatif photos. */
  @Post('moi/conditions')
  @SansConditions()
  async accepter(@Moi() moi: Principal, @Body() dto: AccepterConditionsDto) {
    await this.users.accepterConditions(moi.id, dto.version, await this.parametres.versionConditions(), dto.accordPhotosMarketing);
    return this.moi(moi);
  }

  /** Accord photos (réutilisation par Lazzeko), modifiable à tout moment. */
  @Patch('moi/preferences')
  @SansConditions()
  async preferences(@Moi() moi: Principal, @Body() dto: PreferencesDto) {
    await this.users.preferences(moi.id, dto.accordPhotosMarketing);
    return this.moi(moi);
  }

  @Post('moi/mot-de-passe')
  @SansConditions()
  changerMotDePasse(@Moi() moi: Principal, @Body() dto: ChangerMotDePasseDto) {
    return this.users.changerMotDePasse(moi.id, dto.ancien, dto.nouveau);
  }
}
