-- CreateTable
CREATE TABLE "CategorieAccueil" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "icone" TEXT NOT NULL DEFAULT '📁',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "masquee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategorieAccueil_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategorieAccueil_nom_key" ON "CategorieAccueil"("nom");


-- Reprise : les catégories proposées par défaut (icônes et ordre de l'accueil jusqu'ici), puis celles déjà utilisées.
INSERT INTO "CategorieAccueil" ("id", "nom", "icone", "ordre", "updatedAt") VALUES
  ('cat-mise-en-route', 'Mise en route', '🚀', 0, CURRENT_TIMESTAMP),
  ('cat-diagnostic', 'Diagnostic', '🩺', 1, CURRENT_TIMESTAMP),
  ('cat-impression', 'Impression', '🖨️', 2, CURRENT_TIMESTAMP),
  ('cat-reglages', 'Réglages', '🎛️', 3, CURRENT_TIMESTAMP),
  ('cat-entretien', 'Entretien', '🧽', 4, CURRENT_TIMESTAMP);

INSERT INTO "CategorieAccueil" ("id", "nom", "ordre", "updatedAt")
SELECT 'cat-' || md5(c.nom), c.nom, 4 + ROW_NUMBER() OVER (ORDER BY c.nom), CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT TRIM("categorie") AS nom FROM "Procedure"
  UNION SELECT DISTINCT TRIM("categorie") FROM "Solution"
  UNION SELECT DISTINCT TRIM("valeur"->>'categorie') FROM "CorrectionGuide" WHERE "type" = 'animation' AND "valeur" ? 'categorie'
) c
WHERE c.nom IS NOT NULL AND c.nom <> '' AND c.nom NOT IN (SELECT "nom" FROM "CategorieAccueil");
