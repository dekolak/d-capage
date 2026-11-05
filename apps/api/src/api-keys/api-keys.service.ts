import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Format : dk_<prefixe 8 car.>_<secret 43 car.>. Seul le hash du secret est stocké. */
@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  async creer(nom: string, creeParId?: string) {
    const prefixe = randomBytes(6).toString('base64url').slice(0, 8);
    const secret = randomBytes(32).toString('base64url');
    const k = await this.prisma.apiKey.create({
      data: { nom, prefixe, hash: sha256(secret), creeParId: creeParId ?? null },
    });
    return { id: k.id, nom: k.nom, cle: `dk_${prefixe}_${secret}`, avertissement: 'Copiez la clé maintenant : elle ne sera plus affichée.' };
  }

  async verifier(cle: string) {
    const m = /^dk_([A-Za-z0-9_-]{8})_([A-Za-z0-9_-]+)$/.exec(cle);
    if (!m) return null;
    const k = await this.prisma.apiKey.findUnique({ where: { prefixe: m[1] } });
    if (!k || k.revoqueeLe) return null;
    const a = Buffer.from(sha256(m[2])), b = Buffer.from(k.hash);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    await this.prisma.apiKey.update({ where: { id: k.id }, data: { derniereUtilisation: new Date() } });
    return k;
  }

  lister() {
    return this.prisma.apiKey.findMany({
      select: { id: true, nom: true, prefixe: true, derniereUtilisation: true, revoqueeLe: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoquer(id: string) {
    const k = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!k) throw new NotFoundException();
    await this.prisma.apiKey.update({ where: { id }, data: { revoqueeLe: new Date() } });
    return { ok: true };
  }
}
