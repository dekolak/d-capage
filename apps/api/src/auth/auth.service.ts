import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ActiviteService } from '../activite/activite.service';
import { PrismaService } from '../prisma/prisma.service';
import { LIMITE_ECHECS_IDENTIFIANT } from './limiteur';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private activite: ActiviteService) {}

  static hasher(motDePasse: string) {
    return bcrypt.hash(motDePasse, 12);
  }

  static verifier(motDePasse: string, hash: string) {
    return bcrypt.compare(motDePasse, hash);
  }

  /** Jeton de connexion ; `v` = version du mot de passe (un changement de mot de passe invalide les anciens jetons). */
  signer(user: { id: string; role: string; versionJeton: number }) {
    return this.jwt.signAsync({ sub: user.id, role: user.role, v: user.versionJeton });
  }

  async connexion(identifiant: string, motDePasse: string, espace?: string) {
    const ident = identifiant.trim().toLowerCase();
    // trop d'échecs sur ce compte : bloqué un moment (robot qui essaie des mots de passe)
    LIMITE_ECHECS_IDENTIFIANT.verifier(ident);
    const user = await this.prisma.user.findUnique({ where: { identifiant: ident } });
    // Même message dans tous les cas pour ne pas révéler si l'identifiant existe.
    if (!user || !user.actif || !(await bcrypt.compare(motDePasse, user.passwordHash))) {
      LIMITE_ECHECS_IDENTIFIANT.compter(ident);
      throw new UnauthorizedException('Identifiant ou mot de passe incorrect');
    }
    LIMITE_ECHECS_IDENTIFIANT.effacer(ident);
    const jeton = await this.signer(user);
    if (user.role !== 'ADMIN') this.activite.noter(user.id, { type: 'connexion', espace });
    return { jeton, user: { id: user.id, identifiant: user.identifiant, nom: user.nom, role: user.role } };
  }
}
