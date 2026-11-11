import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ActiviteService } from '../activite/activite.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private activite: ActiviteService) {}

  static hasher(motDePasse: string) {
    return bcrypt.hash(motDePasse, 12);
  }

  async connexion(identifiant: string, motDePasse: string, espace?: string) {
    const user = await this.prisma.user.findUnique({ where: { identifiant: identifiant.trim().toLowerCase() } });
    // Même message dans tous les cas pour ne pas révéler si l'identifiant existe.
    if (!user || !user.actif || !(await bcrypt.compare(motDePasse, user.passwordHash)))
      throw new UnauthorizedException('Identifiant ou mot de passe incorrect');
    const jeton = await this.jwt.signAsync({ sub: user.id, role: user.role });
    if (user.role !== 'ADMIN') this.activite.noter(user.id, { type: 'connexion', espace });
    return { jeton, user: { id: user.id, identifiant: user.identifiant, nom: user.nom, role: user.role } };
  }
}
