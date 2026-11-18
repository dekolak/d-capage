import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth/auth.service';
import { espacesDesModules, MODULE_DEFAUT, modulesDeLEspace } from '../espaces/espaces';
import { PrismaService } from '../prisma/prisma.service';
import { CreerUserDto, ModifierUserDto } from './users.dto';

export const USER_PUBLIC = {
  id: true, identifiant: true, nom: true, role: true, actif: true, createdAt: true, clientLazzeko: true, numeroOdoo: true, numero: true,
  accordPhotosMarketing: true, accordPhotosMarketingLe: true, langue: true,
  modules: { select: { module: true }, orderBy: { module: 'asc' } },
  acceptations: { select: { espace: true, version: true, accepteeLe: true } },
} satisfies Prisma.UserSelect;

type UserBrut = Prisma.UserGetPayload<{ select: typeof USER_PUBLIC }>;

/** Format renvoyé par l'API : modules en liste de slugs, espaces accessibles, conditions acceptées par espace. */
export function formater<T extends UserBrut>(u: T) {
  const { modules, acceptations, ...reste } = u;
  const slugs = modules.map((m) => m.module);
  return {
    ...reste,
    modules: slugs,
    espaces: espacesDesModules(slugs).map((e) => e.slug),
    conditions: Object.fromEntries(acceptations.map((a) => [a.espace, { version: a.version, accepteeLe: a.accepteeLe }])),
  };
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async creer(dto: CreerUserDto) {
    // n° client court (621, 622…) pour les clients ; on réessaie si deux créations tombent sur le même
    for (let essai = 0; ; essai++) {
      const numero = dto.role === 'ADMIN' ? null : Math.max(620, (await this.prisma.user.aggregate({ _max: { numero: true } }))._max.numero ?? 620) + 1;
      try {
        return await this.creerAvec(dto, numero);
      } catch (e) {
        if (essai < 3 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && String(e.meta?.target ?? '').includes('numero')) continue;
        throw e;
      }
    }
  }

  private async creerAvec(dto: CreerUserDto, numero: number | null) {
    try {
      return await this.prisma.user.create({
        data: {
          numero,
          identifiant: dto.identifiant.trim().toLowerCase(),
          passwordHash: await AuthService.hasher(dto.motDePasse),
          nom: dto.nom,
          role: dto.role ?? 'USER',
          clientLazzeko: dto.clientLazzeko ?? true,
          numeroOdoo: dto.numeroOdoo?.trim() || null,
          langue: dto.langue ?? null,
          // Sans `modules` : réglages décapage (Lazzeko), comme avant les espaces.
          modules: { create: [...new Set(dto.modules ?? (dto.role === 'ADMIN' ? [] : [MODULE_DEFAUT]))].map((module) => ({ module })) },
        },
        select: USER_PUBLIC,
      }).then(formater);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && !String(e.meta?.target ?? '').includes('numero'))
        throw new ConflictException('Cet identifiant existe déjà');
      throw e;
    }
  }

  /** Liste (admin), filtrable par n° client Odoo ou par recherche libre (identifiant, nom, n° Odoo). */
  async lister(f: { numeroOdoo?: string; q?: string; espace?: string; module?: string } = {}) {
    const q = f.q?.trim();
    const modules = f.module ? [f.module] : f.espace ? modulesDeLEspace(f.espace) : [];
    const liste = await this.prisma.user.findMany({
      where: {
        ...(f.numeroOdoo ? { numeroOdoo: f.numeroOdoo.trim() } : {}),
        ...(f.module || f.espace ? { modules: { some: { module: { in: modules } } } } : {}),
        ...(q
          ? {
              OR: [
                { identifiant: { contains: q, mode: 'insensitive' } }, { nom: { contains: q, mode: 'insensitive' } }, { numeroOdoo: { contains: q, mode: 'insensitive' } },
                ...(/^[a-z]?-?\d+$/i.test(q) ? [{ numero: Number(q.replace(/\D/g, '')) }] : []),
              ],
            }
          : {}),
      },
      select: { ...USER_PUBLIC, _count: { select: { fiches: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return liste.map(formater);
  }

  /** Client par son n° court (« 621 », « L621 ») : pour lui envoyer un pas-à-pas (admin). */
  async parNumero(texte: string) {
    const n = Number(texte.replace(/\D/g, ''));
    const u = n
      ? await this.prisma.user.findUnique({
          where: { numero: n },
          select: { id: true, numero: true, nom: true, identifiant: true, numeroOdoo: true, machines: { select: { surnom: true, variante: { select: { nom: true, modele: { select: { nom: true, fabricant: { select: { nom: true } } } } } } } } },
        })
      : null;
    if (!u) throw new NotFoundException(`Aucun client avec le n° ${texte}`);
    const { machines, ...client } = u;
    return { ...client, machines: machines.map((m) => m.surnom || `${m.variante.modele.fabricant.nom} ${m.variante.modele.nom}`) };
  }

  async trouver(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: USER_PUBLIC });
    if (!u) throw new NotFoundException();
    return formater(u);
  }

  async modifier(id: string, dto: ModifierUserDto) {
    await this.trouver(id);
    const { motDePasse, numeroOdoo, modules, ...reste } = dto;
    if (modules) {
      // Remplace la liste des modules (accès aux espaces).
      await this.prisma.$transaction([
        this.prisma.userModule.deleteMany({ where: { userId: id, module: { notIn: modules } } }),
        this.prisma.userModule.createMany({ data: [...new Set(modules)].map((module) => ({ userId: id, module })), skipDuplicates: true }),
      ]);
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        ...reste,
        ...(numeroOdoo !== undefined ? { numeroOdoo: numeroOdoo?.trim() || null } : {}),
        ...(motDePasse ? { passwordHash: await AuthService.hasher(motDePasse) } : {}),
      },
      select: USER_PUBLIC,
    }).then(formater);
  }

  async accepterConditions(id: string, espace: string, version: number, courante: number, accordPhotosMarketing?: boolean) {
    if (version !== courante) throw new ConflictException('Les conditions ont changé : rechargez la page');
    const maintenant = new Date();
    return this.prisma.user.update({
      where: { id },
      data: {
        acceptations: {
          upsert: { where: { userId_espace: { userId: id, espace } }, update: { version, accepteeLe: maintenant }, create: { espace, version, accepteeLe: maintenant } },
        },
        ...(accordPhotosMarketing !== undefined ? { accordPhotosMarketing, accordPhotosMarketingLe: new Date() } : {}),
      },
      select: USER_PUBLIC,
    });
  }

  async preferences(id: string, p: { accordPhotosMarketing?: boolean; langue?: string | null }) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(p.accordPhotosMarketing !== undefined ? { accordPhotosMarketing: p.accordPhotosMarketing, accordPhotosMarketingLe: new Date() } : {}),
        ...(p.langue !== undefined ? { langue: p.langue } : {}),
      },
      select: USER_PUBLIC,
    }).then(formater);
  }

  async changerMotDePasse(id: string, ancien: string, nouveau: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u || !(await bcrypt.compare(ancien, u.passwordHash))) throw new UnauthorizedException('Ancien mot de passe incorrect');
    await this.prisma.user.update({ where: { id }, data: { passwordHash: await AuthService.hasher(nouveau) } });
    return { ok: true };
  }
}
