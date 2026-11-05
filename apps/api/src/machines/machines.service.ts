import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CatalogueService, nomMachine } from '../catalogue/catalogue.service';
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
      technologie: m.variante.modele.technologie.slug,
      version,
    };
  }

  async ajouter(userId: string, varianteId: string, surnom?: string) {
    const v = await this.prisma.variante.findUnique({ where: { id: varianteId } });
    if (!v || !v.actif) throw new NotFoundException('Machine inconnue dans le catalogue');
    const s = surnom?.trim() || null;
    const existe = await this.prisma.userMachine.findFirst({ where: { userId, varianteId, surnom: s } });
    if (existe) throw new ConflictException('Cette machine est déjà dans la liste');
    const m = await this.prisma.userMachine.create({ data: { userId, varianteId, surnom: s }, include: INCLUDE });
    return this.vue(m);
  }

  async modifier(userId: string, id: string, surnom?: string) {
    await this.trouver(userId, id);
    const m = await this.prisma.userMachine.update({ where: { id }, data: { surnom: surnom?.trim() || null }, include: INCLUDE });
    return this.vue(m);
  }

  async retirer(userId: string, id: string) {
    await this.trouver(userId, id);
    // Les fiches restent (userMachineId passe à null), elles gardent leur version d'interface.
    await this.prisma.userMachine.delete({ where: { id } });
    return { ok: true };
  }

  async trouver(userId: string, id: string) {
    const m = await this.prisma.userMachine.findFirst({ where: { id, userId } });
    if (!m) throw new NotFoundException('Machine introuvable');
    return m;
  }
}
