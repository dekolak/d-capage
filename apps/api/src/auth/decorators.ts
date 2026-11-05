import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const PUBLIC = 'public';
export const ROLES = 'roles';
export const CLE_API = 'cleApi';

/** Route accessible sans connexion. */
export const Public = () => SetMetadata(PUBLIC, true);
/** Route réservée à certains rôles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
/** Route accessible aussi avec une clé API (en-tête X-Api-Key), en plus d'un admin connecté. */
export const AutoriseCleApi = () => SetMetadata(CLE_API, true);

export interface Principal {
  type: 'user' | 'cleApi';
  id: string;
  role: Role;
}

export const Moi = createParamDecorator((_: unknown, ctx: ExecutionContext): Principal => {
  return ctx.switchToHttp().getRequest().principal;
});
