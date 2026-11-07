import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreerUserDto, ModifierUserDto } from './users.dto';

export const USER_PUBLIC = {
  id: true, identifiant: true, nom: true, role: true, actif: true, createdAt: true, clientLazzeko: true, numeroOdoo: true,
  conditionsVersion: true, conditionsAccepteesLe: true, accordPhotosMarketing: true, accordPhotosMarketingLe: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async creer(dto: CreerUserDto) {
    try {
      return await this.prisma.user.create({
        data: {
          identifiant: dto.identifiant.trim().toLowerCase(),
          passwordHash: await AuthService.hasher(dto.motDePasse),
          nom: dto.nom,
          role: dto.role ?? 'USER',
          clientLazzeko: dto.clientLazzeko ?? true,
          numeroOdoo: dto.numeroOdoo?.trim() || null,
        },
        select: USER_PUBLIC,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        throw new ConflictException('Cet identifiant existe déjà');
      throw e;
    }
  }

  /** Liste (admin), filtrable par n° client Odoo ou par recherche libre (identifiant, nom, n° Odoo). */
  lister(f: { numeroOdoo?: string; q?: string } = {}) {
    const q = f.q?.trim();
    return this.prisma.user.findMany({
      where: {
        ...(f.numeroOdoo ? { numeroOdoo: f.numeroOdoo.trim() } : {}),
        ...(q
          ? { OR: [{ identifiant: { contains: q, mode: 'insensitive' } }, { nom: { contains: q, mode: 'insensitive' } }, { numeroOdoo: { contains: q, mode: 'insensitive' } }] }
          : {}),
      },
      select: { ...USER_PUBLIC, _count: { select: { fiches: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async trouver(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: USER_PUBLIC });
    if (!u) throw new NotFoundException();
    return u;
  }

  async modifier(id: string, dto: ModifierUserDto) {
    await this.trouver(id);
    const { motDePasse, numeroOdoo, ...reste } = dto;
    return this.prisma.user.update({
      where: { id },
      data: {
        ...reste,
        ...(numeroOdoo !== undefined ? { numeroOdoo: numeroOdoo?.trim() || null } : {}),
        ...(motDePasse ? { passwordHash: await AuthService.hasher(motDePasse) } : {}),
      },
      select: USER_PUBLIC,
    });
  }

  async accepterConditions(id: string, version: number, courante: number, accordPhotosMarketing?: boolean) {
    if (version !== courante) throw new ConflictException('Les conditions ont changé : rechargez la page');
    return this.prisma.user.update({
      where: { id },
      data: {
        conditionsVersion: version,
        conditionsAccepteesLe: new Date(),
        ...(accordPhotosMarketing !== undefined ? { accordPhotosMarketing, accordPhotosMarketingLe: new Date() } : {}),
      },
      select: USER_PUBLIC,
    });
  }

  async preferences(id: string, accordPhotosMarketing: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { accordPhotosMarketing, accordPhotosMarketingLe: new Date() },
      select: USER_PUBLIC,
    });
  }

  async changerMotDePasse(id: string, ancien: string, nouveau: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u || !(await bcrypt.compare(ancien, u.passwordHash))) throw new UnauthorizedException('Ancien mot de passe incorrect');
    await this.prisma.user.update({ where: { id }, data: { passwordHash: await AuthService.hasher(nouveau) } });
    return { ok: true };
  }
}
