import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { chargerConfig, ConfigMachine } from '@decapage/machine-kit';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogueService {
  /** Les versions publiées ne changent que via le seed : cache mémoire simple. */
  private cache = new Map<string, ConfigMachine>();

  constructor(private prisma: PrismaService) {}

  /** Catalogue des fiches de réglage (Lazzeko) : modèles visibles dans Lazzeko, variantes avec un écran de réglage. */
  async lister() {
    const fabricants = await this.prisma.fabricant.findMany({
      orderBy: { nom: 'asc' },
      include: {
        modeles: {
          where: { espaces: { has: 'lazzeko' } },
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
    // seulement ce qui a un écran de réglage
    return fabricants.map((f) => ({
      id: f.id,
      slug: f.slug,
      nom: f.nom,
      modeles: f.modeles.filter((m) => m.variantes.some((v) => v.versions.length)).map((m) => ({
        id: m.id,
        slug: m.slug,
        nom: m.nom,
        technologie: m.technologie?.slug ?? null,
        imageUrl: imageMachine({ id: '', imageCle: null, imageMaj: null, modele: m }),
        variantes: m.variantes
          .filter((v) => v.versions.length)
          .map((v) => ({ id: v.id, slug: v.slug, nom: v.nom, version: v.versions[0], imageUrl: imageMachine({ ...v, modele: m }), imagePropre: !!v.imageCle })),
      })),
    })).filter((f) => f.modeles.length);
  }

  // ---------- administration : tout le catalogue (Lazzeko et Kiavik), créable depuis l'app ----------
  async listerAdmin() {
    const fabricants = await this.prisma.fabricant.findMany({
      orderBy: { nom: 'asc' },
      include: {
        modeles: {
          orderBy: { nom: 'asc' },
          include: {
            technologie: true,
            variantes: { orderBy: { nom: 'asc' }, include: { _count: { select: { machines: true, versions: true } } } },
          },
        },
      },
    });
    return fabricants.map((f) => ({
      id: f.id, slug: f.slug, nom: f.nom,
      modeles: f.modeles.map((m) => ({
        id: m.id, slug: m.slug, nom: m.nom, espaces: m.espaces, technologie: m.technologie?.slug ?? null,
        imageUrl: imageMachine({ id: '', imageCle: null, imageMaj: null, modele: m }),
        variantes: m.variantes.map((v) => ({
          id: v.id, slug: v.slug, nom: v.nom, actif: v.actif, imageUrl: imageMachine({ ...v, modele: m }), imagePropre: !!v.imageCle,
          /** Écran de réglage (fiches Lazzeko). */
          reglages: v._count.versions > 0, machines: v._count.machines,
        })),
      })),
    }));
  }

  async creerFabricant(nom: string) {
    const slug = slugifier(nom);
    if (await this.prisma.fabricant.findUnique({ where: { slug } })) throw new ConflictException('Ce fabricant existe déjà');
    await this.prisma.fabricant.create({ data: { slug, nom: nom.trim() } });
    return this.listerAdmin();
  }

  async creerModele(d: { fabricantId: string; nom: string; espaces: string[] }) {
    if (!(await this.prisma.fabricant.findUnique({ where: { id: d.fabricantId } }))) throw new NotFoundException('Fabricant introuvable');
    const slug = slugifier(d.nom);
    if (await this.prisma.modele.findUnique({ where: { fabricantId_slug: { fabricantId: d.fabricantId, slug } } })) throw new ConflictException('Ce modèle existe déjà');
    const m = await this.prisma.modele.create({ data: { fabricantId: d.fabricantId, slug, nom: d.nom.trim(), espaces: d.espaces } });
    // une variante « Standard » pour pouvoir l'attribuer tout de suite
    await this.prisma.variante.create({ data: { modeleId: m.id, slug: 'standard', nom: 'Standard' } });
    return this.listerAdmin();
  }

  async modifierModele(id: string, d: { nom?: string; espaces?: string[] }) {
    if (!(await this.prisma.modele.findUnique({ where: { id } }))) throw new NotFoundException('Modèle introuvable');
    await this.prisma.modele.update({ where: { id }, data: { ...(d.nom ? { nom: d.nom.trim() } : {}), ...(d.espaces ? { espaces: d.espaces } : {}) } });
    return this.listerAdmin();
  }

  async creerVariante(modeleId: string, nom: string) {
    if (!(await this.prisma.modele.findUnique({ where: { id: modeleId } }))) throw new NotFoundException('Modèle introuvable');
    const slug = slugifier(nom);
    if (await this.prisma.variante.findUnique({ where: { modeleId_slug: { modeleId, slug } } })) throw new ConflictException('Cette variante existe déjà');
    await this.prisma.variante.create({ data: { modeleId, slug, nom: nom.trim() } });
    return this.listerAdmin();
  }

  async modifierVariante(id: string, d: { nom?: string; actif?: boolean }) {
    if (!(await this.prisma.variante.findUnique({ where: { id } }))) throw new NotFoundException('Variante introuvable');
    await this.prisma.variante.update({ where: { id }, data: { ...(d.nom ? { nom: d.nom.trim() } : {}), ...(d.actif !== undefined ? { actif: d.actif } : {}) } });
    return this.listerAdmin();
  }

  /** Supprimer une variante (ou un modèle entier) : seulement si aucune machine de client ni écran de réglage n'y est lié. */
  async supprimerVariante(id: string) {
    const v = await this.prisma.variante.findUnique({ where: { id }, include: { _count: { select: { machines: true, versions: true } } } });
    if (!v) throw new NotFoundException('Variante introuvable');
    if (v._count.machines || v._count.versions) throw new BadRequestException('Des machines de clients ou des fiches de réglage utilisent cette variante : désactivez-la plutôt');
    await this.prisma.variante.delete({ where: { id } });
    return this.listerAdmin();
  }

  async supprimerModele(id: string) {
    const m = await this.prisma.modele.findUnique({ where: { id }, include: { variantes: { include: { _count: { select: { machines: true, versions: true } } } } } });
    if (!m) throw new NotFoundException('Modèle introuvable');
    if (m.variantes.some((v) => v._count.machines || v._count.versions)) throw new BadRequestException('Des machines de clients ou des fiches de réglage utilisent ce modèle');
    await this.prisma.$transaction([this.prisma.variante.deleteMany({ where: { modeleId: id } }), this.prisma.modele.delete({ where: { id } })]);
    return this.listerAdmin();
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
  // la variante « Standard » (créée avec un modèle) ne s'affiche pas
  return v.nom === 'Standard' ? `${v.modele.fabricant.nom} ${v.modele.nom}` : `${v.modele.fabricant.nom} ${v.modele.nom} ${v.nom}`;
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

/** « DXonJet i3200 » → « dxonjet-i3200 ». */
export function slugifier(nom: string) {
  const s = nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!s) throw new BadRequestException('Nom invalide');
  return s.slice(0, 60);
}
