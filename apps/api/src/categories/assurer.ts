import { PrismaService } from '../prisma/prisma.service';

/** Crée la catégorie de l'accueil si elle n'existe pas encore (à la fin de l'ordre). Nom vide : rien. */
export async function assurerCategorie(prisma: PrismaService, nom: string | undefined | null) {
  const n = nom?.trim();
  if (!n || (await prisma.categorieAccueil.findUnique({ where: { nom: n }, select: { id: true } }))) return;
  const ordre = ((await prisma.categorieAccueil.aggregate({ _max: { ordre: true } }))._max.ordre ?? -1) + 1;
  await prisma.categorieAccueil.upsert({ where: { nom: n }, create: { nom: n, ordre }, update: {} });
}
