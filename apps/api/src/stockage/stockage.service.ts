import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';

/**
 * Stockage des fichiers. Implémentation disque local (dossier UPLOAD_DIR).
 * Pour passer sur S3 / R2 plus tard : même interface, autre classe.
 */
@Injectable()
export class StockageService {
  private racine: string;

  constructor(config: ConfigService) {
    this.racine = resolve(config.get<string>('UPLOAD_DIR') ?? 'uploads');
  }

  private chemin(cle: string) {
    const p = resolve(join(this.racine, cle));
    if (!p.startsWith(this.racine)) throw new Error('Clé de stockage invalide');
    return p;
  }

  async ecrire(cle: string, contenu: Buffer) {
    const p = this.chemin(cle);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, contenu);
  }

  lire(cle: string): Readable | null {
    const p = this.chemin(cle);
    return existsSync(p) ? createReadStream(p) : null;
  }

  async supprimer(cle: string) {
    await rm(this.chemin(cle), { force: true });
  }
}

/** Vérifie la signature binaire d'une image (ne pas se fier au type annoncé par le client). */
export function formatImage(b: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}
export const MIME_IMAGE = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
