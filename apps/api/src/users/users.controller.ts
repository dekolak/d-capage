import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AutoriseCleApi, EspaceCourant, Moi, Principal, Roles, SansConditions } from '../auth/decorators';
import { espace as espaceDef, ESPACES } from '../espaces/espaces';
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
  /** ?numeroOdoo=… pour retrouver un compte depuis Odoo ; ?q=… recherche libre ; ?espace= ou ?module= pour filtrer. */
  lister(@Query('numeroOdoo') numeroOdoo?: string, @Query('q') q?: string, @Query('espace') espace?: string, @Query('module') module?: string) {
    return this.users.lister({ numeroOdoo, q, espace, module });
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
  async moi(@Moi() moi: Principal, @EspaceCourant() courant?: string) {
    const u = await this.users.trouver(moi.id);
    const admin = u.role === 'ADMIN';
    // Espaces accessibles (tous pour l'admin) et conditions à jour ou non pour chacun.
    const espaces = await Promise.all(
      ESPACES.filter((e) => admin || u.espaces.includes(e.slug)).map(async (e) => ({
        slug: e.slug,
        conditionsAJour: admin || (u.conditions[e.slug]?.version ?? 0) >= (await this.parametres.versionConditions(e.slug)),
      })),
    );
    const ici = espaces.find((e) => e.slug === courant);
    return { ...u, espaces, conditionsAJour: ici?.conditionsAJour ?? true };
  }

  /** Accepter les conditions (partage communautaire) + accord facultatif photos. */
  @Post('moi/conditions')
  @SansConditions()
  async accepter(@Moi() moi: Principal, @Body() dto: AccepterConditionsDto, @EspaceCourant() courant: string) {
    const espace = espaceDef(dto.espace ?? courant)!.slug;
    // L'accord photos ne concerne que l'espace avec partage communautaire (Lazzeko).
    const accord = espaceDef(espace)!.communaute ? dto.accordPhotosMarketing : undefined;
    await this.users.accepterConditions(moi.id, espace, dto.version, await this.parametres.versionConditions(espace), accord);
    return this.moi(moi, courant);
  }

  /** Accord photos (réutilisation par Lazzeko) et langue de l'app, modifiables à tout moment. */
  @Patch('moi/preferences')
  @SansConditions()
  async preferences(@Moi() moi: Principal, @Body() dto: PreferencesDto, @EspaceCourant() courant: string) {
    await this.users.preferences(moi.id, dto);
    return this.moi(moi, courant);
  }

  @Post('moi/mot-de-passe')
  @SansConditions()
  changerMotDePasse(@Moi() moi: Principal, @Body() dto: ChangerMotDePasseDto) {
    return this.users.changerMotDePasse(moi.id, dto.ancien, dto.nouveau);
  }
}
