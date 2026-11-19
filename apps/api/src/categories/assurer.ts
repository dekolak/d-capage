import { PrismaService } from '../prisma/prisma.service';

/**
 * Crée la catégorie si elle n'existe pas encore (à la fin de l'ordre), pour la société du contenu (`espace`).
 * Elle existe déjà pour d'autres sociétés seulement : la société du contenu s'ajoute. Nom vide : rien.
 */
export async function assurerCategorie(prisma: PrismaService, nom: string | undefined | null, espace?: string | null) {
  const n = nom?.trim();
  if (!n) return;
  const c = await prisma.categorieAccueil.findUnique({ where: { nom: n }, select: { id: true, espaces: true } });
  if (c) {
    if (espace && c.espaces.length && !c.espaces.includes(espace)) await prisma.categorieAccueil.update({ where: { id: c.id }, data: { espaces: [...c.espaces, espace] } });
    return;
  }
  const ordre = ((await prisma.categorieAccueil.aggregate({ _max: { ordre: true } }))._max.ordre ?? -1) + 1;
  await prisma.categorieAccueil.upsert({ where: { nom: n }, create: { nom: n, ordre, espaces: espace ? [espace] : [] }, update: {} });
}
