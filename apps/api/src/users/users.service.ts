import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreerUserDto, ModifierUserDto } from './users.dto';

export const USER_PUBLIC = { id: true, identifiant: true, nom: true, role: true, actif: true, createdAt: true } as const;

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
        },
        select: USER_PUBLIC,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        throw new ConflictException('Cet identifiant existe déjà');
      throw e;
    }
  }

  lister() {
    return this.prisma.user.findMany({ select: { ...USER_PUBLIC, _count: { select: { fiches: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async trouver(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: USER_PUBLIC });
    if (!u) throw new NotFoundException();
    return u;
  }

  async modifier(id: string, dto: ModifierUserDto) {
    await this.trouver(id);
    const { motDePasse, ...reste } = dto;
    return this.prisma.user.update({
      where: { id },
      data: { ...reste, ...(motDePasse ? { passwordHash: await AuthService.hasher(motDePasse) } : {}) },
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
