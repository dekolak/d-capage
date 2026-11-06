import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { ParametresService } from '../parametres/parametres.service';
import { PrismaService } from '../prisma/prisma.service';
import { CLE_API, Principal, PUBLIC, ROLES, SANS_CONDITIONS } from './decorators';

/**
 * Garde globale :
 *  - @Public() → libre ;
 *  - en-tête X-Api-Key → accepté seulement sur les routes @AutoriseCleApi() ;
 *  - sinon jeton JWT (Authorization: Bearer …) d'un utilisateur actif, puis contrôle @Roles().
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
    if (meta<boolean>(PUBLIC)) return true;
    const req = ctx.switchToHttp().getRequest();

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
    const user = await this.prisma.user.findUnique({ where: { id: sub }, select: { id: true, role: true, actif: true, conditionsVersion: true } });
    if (!user?.actif) throw new UnauthorizedException();
    req.principal = { type: 'user', id: user.id, role: user.role } satisfies Principal;

    // Le partage communautaire est la condition d'utilisation : rien n'est accessible avant de l'accepter.
    if (user.role !== Role.ADMIN && !meta<boolean>(SANS_CONDITIONS)) {
      const courante = await this.parametres.versionConditions();
      if ((user.conditionsVersion ?? 0) < courante)
        throw new ForbiddenException({ message: 'Conditions d\'utilisation à accepter', code: 'CONDITIONS_A_ACCEPTER' });
    }

    const roles = meta<Role[]>(ROLES);
    if (roles?.length && !roles.includes(user.role)) throw new ForbiddenException();
    return true;
  }
}
