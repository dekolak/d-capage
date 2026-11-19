-- Catégories rattachées à leur société, d'après le contenu qui les utilise (pas-à-pas, Bon à savoir) ; sans contenu : toutes.
-- AlterTable
ALTER TABLE "CategorieAccueil" ADD COLUMN     "espaces" TEXT[] DEFAULT ARRAY[]::TEXT[];


UPDATE "CategorieAccueil" c SET "espaces" = s.espaces
FROM (
  SELECT categorie, ARRAY_AGG(DISTINCT espace ORDER BY espace) AS espaces
  FROM (SELECT categorie, espace FROM "Procedure" UNION SELECT categorie, espace FROM "Solution") u
  GROUP BY categorie
) s
WHERE s.categorie = c.nom;
