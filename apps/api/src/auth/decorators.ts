import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const PUBLIC = 'public';
export const ROLES = 'roles';
export const CLE_API = 'cleApi';
export const SANS_CONDITIONS = 'sansConditions';
export const MODULE = 'module';

/** Route accessible sans connexion. */
export const Public = () => SetMetadata(PUBLIC, true);
/** Route réservée à certains rôles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
/** Route accessible aussi avec une clé API (en-tête X-Api-Key), en plus d'un admin connecté. */
export const AutoriseCleApi = () => SetMetadata(CLE_API, true);
/** Route accessible avant d'avoir accepté les conditions d'utilisation (compte, conditions…). */
export const SansConditions = () => SetMetadata(SANS_CONDITIONS, true);

/**
 * Route réservée aux comptes qui ont ce module (ex. reglages-decapage) ; les conditions de son espace doivent être acceptées.
 * Le module peut dépendre de la requête (ex. guide-<slug> selon l'adresse appelée).
 */
export type ModuleDeLaRequete = (req: { params: Record<string, string> }) => string;
export const ModuleRequis = (module: string | ModuleDeLaRequete) => SetMetadata(MODULE, module);

export interface Principal {
  type: 'user' | 'cleApi';
  id: string;
  role: Role;
}

export const Moi = createParamDecorator((_: unknown, ctx: ExecutionContext): Principal => {
  return ctx.switchToHttp().getRequest().principal;
});

/** Espace de la requête (slug) : celui du module de la route, sinon en-tête X-Espace, sinon l'adresse. */
export const EspaceCourant = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  return ctx.switchToHttp().getRequest().espace;
});
