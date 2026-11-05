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
