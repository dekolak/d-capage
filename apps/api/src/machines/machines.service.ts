import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CatalogueService, imageMachine, nomMachine } from '../catalogue/catalogue.service';
import { PrismaService } from '../prisma/prisma.service';

const INCLUDE = { variante: { include: { modele: { include: { fabricant: true, technologie: true } } } } } as const;

@Injectable()
export class MachinesService {
  constructor(private prisma: PrismaService, private catalogue: CatalogueService) {}

  async lister(userId: string) {
    const ms = await this.prisma.userMachine.findMany({ where: { userId }, include: INCLUDE, orderBy: { createdAt: 'asc' } });
    return Promise.all(ms.map((m) => this.vue(m)));
  }

  private async vue(m: Prisma.UserMachineGetPayload<{ include: typeof INCLUDE }>) {
    const version = await this.catalogue.derniereVersion(m.varianteId).catch(() => null);
    return {
      id: m.id,
      surnom: m.surnom,
      varianteId: m.varianteId,
      modeleId: m.variante.modeleId,
      nom: nomMachine(m.variante),
      varianteNom: m.variante.nom,
      imageUrl: imageMachine(m.variante),
      technologie: m.variante.modele.technologie?.slug ?? null,
      espaces: m.variante.modele.espaces,
      numeroSerie: m.numeroSerie,
      miseEnService: m.miseEnService,
      numero: m.numero,
      version,
    };
  }

  /** Ajout par l'admin : n° de série et date de mise en service (aujourd'hui par défaut). */
  async ajouter(userId: string, varianteId: string, d: { surnom?: string; numeroSerie?: string; miseEnService?: Date } = {}) {
    const v = await this.prisma.variante.findUnique({ where: { id: varianteId } });
    if (!v || !v.actif) throw new NotFoundException('Machine inconnue dans le catalogue');
    const s = d.surnom?.trim() || null;
    const serie = d.numeroSerie?.trim() || null;
    const existe = serie
      ? await this.prisma.userMachine.findFirst({ where: { varianteId, numeroSerie: serie } })
      : await this.prisma.userMachine.findFirst({ where: { userId, varianteId, surnom: s, numeroSerie: null } });
    if (existe) throw new ConflictException(serie ? 'Ce n° de série est déjà attribué' : 'Cette machine est déjà dans la liste (ajoutez un n° de série ou un surnom)');
    // n° court : le suivant (621, 622…) ; on réessaie si deux ajouts tombent sur le même
    for (let essai = 0; ; essai++) {
      const numero = Math.max(620, (await this.prisma.userMachine.aggregate({ _max: { numero: true } }))._max.numero ?? 620) + 1;
      try {
        const m = await this.prisma.userMachine.create({
          data: { userId, varianteId, surnom: s, numeroSerie: serie, miseEnService: d.miseEnService ?? new Date(), numero },
          include: INCLUDE,
        });
        return this.vue(m);
      } catch (e) {
        if (essai >= 3 || (e as { code?: string }).code !== 'P2002') throw e;
      }
    }
  }

  /** Le client peut changer le surnom ; l'admin aussi le n° de série et la mise en service. */
  async modifier(userId: string, id: string, d: { surnom?: string; numeroSerie?: string | null; miseEnService?: Date | null }) {
    await this.trouver(userId, id);
    const m = await this.prisma.userMachine.update({
      where: { id },
      data: {
        ...(d.surnom !== undefined ? { surnom: d.surnom.trim() || null } : {}),
        ...(d.numeroSerie !== undefined ? { numeroSerie: d.numeroSerie?.trim() || null } : {}),
        ...(d.miseEnService !== undefined ? { miseEnService: d.miseEnService } : {}),
      },
      include: INCLUDE,
    });
    return this.vue(m);
  }

  async retirer(userId: string, id: string) {
    await this.trouver(userId, id);
    // Les fiches restent (userMachineId passe à null), elles gardent leur version d'interface.
    await this.prisma.userMachine.delete({ where: { id } });
    return { ok: true };
  }

  /** Machine par son n° court (« 621 », « L621 », « K-621 ») : pour envoyer un pas-à-pas (admin). */
  async parNumero(texte: string) {
    const n = Number(texte.replace(/\D/g, ''));
    const m = n ? await this.prisma.userMachine.findUnique({ where: { numero: n }, include: { ...INCLUDE, user: { select: { id: true, nom: true, identifiant: true, numeroOdoo: true } } } }) : null;
    if (!m) throw new NotFoundException(`Aucune machine avec le n° ${texte}`);
    return { ...(await this.vue(m)), client: m.user };
  }

  async trouver(userId: string, id: string) {
    const m = await this.prisma.userMachine.findFirst({ where: { id, userId } });
    if (!m) throw new NotFoundException('Machine introuvable');
    return m;
  }
}
