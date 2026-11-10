import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { espaceDeLaRequete, espaceDuModule } from '../espaces/espaces';
import { ParametresService } from '../parametres/parametres.service';
import { PrismaService } from '../prisma/prisma.service';
import { CLE_API, MODULE, ModuleDeLaRequete, Principal, PUBLIC, ROLES, SANS_CONDITIONS } from './decorators';

/**
 * Garde globale :
 *  - @Public() → libre ;
 *  - en-tête X-Api-Key → accepté seulement sur les routes @AutoriseCleApi() ;
 *  - sinon jeton JWT (Authorization: Bearer …) d'un utilisateur actif, puis :
 *    - @ModuleRequis() → le compte doit avoir ce module (403 MODULE_NON_AUTORISE) ;
 *    - conditions d'utilisation de l'espace acceptées (403 CONDITIONS_A_ACCEPTER), sauf @SansConditions() ;
 *    - @Roles().
 *  Les admins ont accès à tout.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    private prisma: PrismaService,
    private cles: ApiKeysService,
    private parametres: ParametresService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const meta = <T>(k: string) => this.reflector.getAllAndOverride<T>(k, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest();
    const m = meta<string | ModuleDeLaRequete>(MODULE);
    const moduleRequis = typeof m === 'function' ? m(req) : m;
    const esp = (moduleRequis && espaceDuModule(moduleRequis)) || espaceDeLaRequete(req);
    req.espace = esp.slug;
    if (meta<boolean>(PUBLIC)) return true;

    const cle = req.headers['x-api-key'];
    if (typeof cle === 'string' && cle) {
      if (!meta<boolean>(CLE_API)) throw new ForbiddenException('Clé API non autorisée sur cette route');
      const k = await this.cles.verifier(cle);
      if (!k) throw new UnauthorizedException('Clé API invalide');
      req.principal = { type: 'cleApi', id: k.id, role: Role.ADMIN } satisfies Principal;
      return true;
    }

    const [type, jeton] = String(req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !jeton) throw new UnauthorizedException();
    let sub: string;
    try {
      sub = (await this.jwt.verifyAsync<{ sub: string }>(jeton)).sub;
    } catch {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, role: true, actif: true, modules: { select: { module: true } }, acceptations: { where: { espace: esp.slug }, select: { version: true } } },
    });
    if (!user?.actif) throw new UnauthorizedException();
    req.principal = { type: 'user', id: user.id, role: user.role } satisfies Principal;

    if (user.role !== Role.ADMIN) {
      const modules = user.modules.map((m) => m.module);
      if (moduleRequis && !modules.includes(moduleRequis))
        throw new ForbiddenException({ message: 'Cette fonction n\'est pas activée sur votre compte', code: 'MODULE_NON_AUTORISE' });
      // Conditions de l'espace (pour Lazzeko : le partage communautaire), si le compte a accès à cet espace.
      const accesEspace = esp.modules.some((m) => modules.includes(m.slug));
      if (accesEspace && !meta<boolean>(SANS_CONDITIONS)) {
        const courante = await this.parametres.versionConditions(esp.slug);
        if ((user.acceptations[0]?.version ?? 0) < courante)
          throw new ForbiddenException({ message: 'Conditions d\'utilisation à accepter', code: 'CONDITIONS_A_ACCEPTER', espace: esp.slug });
      }
    }

    const roles = meta<Role[]>(ROLES);
    if (roles?.length && !roles.includes(user.role)) throw new ForbiddenException();
    return true;
  }
}
