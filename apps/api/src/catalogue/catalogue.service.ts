import { Injectable, NotFoundException } from '@nestjs/common';
import { chargerConfig, ConfigMachine } from '@decapage/machine-kit';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogueService {
  /** Les versions publiées ne changent que via le seed : cache mémoire simple. */
  private cache = new Map<string, ConfigMachine>();

  constructor(private prisma: PrismaService) {}

  async lister() {
    const fabricants = await this.prisma.fabricant.findMany({
      orderBy: { nom: 'asc' },
      include: {
        modeles: {
          orderBy: { nom: 'asc' },
          include: {
            technologie: true,
            variantes: {
              where: { actif: true },
              orderBy: { nom: 'asc' },
              include: { versions: { where: { publiee: true }, orderBy: { numero: 'desc' }, take: 1, select: { id: true, numero: true } } },
            },
          },
        },
      },
    });
    return fabricants.map((f) => ({
      id: f.id,
      slug: f.slug,
      nom: f.nom,
      modeles: f.modeles.map((m) => ({
        id: m.id,
        slug: m.slug,
        nom: m.nom,
        technologie: m.technologie.slug,
        imageUrl: imageMachine({ id: '', imageCle: null, imageMaj: null, modele: m }),
        variantes: m.variantes
          .filter((v) => v.versions.length)
          .map((v) => ({ id: v.id, slug: v.slug, nom: v.nom, version: v.versions[0], imageUrl: imageMachine({ ...v, modele: m }), imagePropre: !!v.imageCle })),
      })),
    }));
  }

  async derniereVersion(varianteId: string) {
    const v = await this.prisma.versionInterface.findFirst({
      where: { varianteId, publiee: true },
      orderBy: { numero: 'desc' },
      select: { id: true, numero: true },
    });
    if (!v) throw new NotFoundException('Aucune version publiée pour cette machine');
    return v;
  }

  async config(versionId: string): Promise<ConfigMachine> {
    const c = this.cache.get(versionId);
    if (c) return c;
    const v = await this.prisma.versionInterface.findUnique({ where: { id: versionId } });
    if (!v) throw new NotFoundException('Version d\'interface introuvable');
    const cfg = chargerConfig(v.config);
    this.cache.set(versionId, cfg);
    return cfg;
  }

  async version(versionId: string) {
    const v = await this.prisma.versionInterface.findUnique({
      where: { id: versionId },
      include: { variante: { include: { modele: { include: { fabricant: true } } } } },
    });
    if (!v) throw new NotFoundException();
    return {
      id: v.id,
      numero: v.numero,
      varianteId: v.varianteId,
      nomMachine: nomMachine(v.variante),
      config: await this.config(v.id),
    };
  }
}

export function nomMachine(v: { nom: string; modele: { nom: string; fabricant: { nom: string } } }) {
  return `${v.modele.fabricant.nom} ${v.modele.nom} ${v.nom}`;
}

type AvecImage = { id: string; imageCle: string | null; imageMaj: Date | null };

/**
 * Adresse de la miniature d'une machine : celle de la variante, sinon celle du modèle, sinon null
 * (l'app affiche alors une illustration par défaut). ?v= force le rafraîchissement après un nouvel envoi.
 */
export function imageMachine(v: AvecImage & { modele: AvecImage }): string | null {
  if (v.imageCle) return `/api/catalogue/variantes/${v.id}/image?v=${v.imageMaj?.getTime() ?? 0}`;
  if (v.modele.imageCle) return `/api/catalogue/modeles/${v.modele.id}/image?v=${v.modele.imageMaj?.getTime() ?? 0}`;
  return null;
}
