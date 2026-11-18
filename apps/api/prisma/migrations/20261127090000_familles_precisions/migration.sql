-- AlterTable
ALTER TABLE "GroupeTag" ADD COLUMN     "choixUnique" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FichePrecision" (
    "id" TEXT NOT NULL,
    "ficheId" TEXT NOT NULL,
    "groupeId" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FichePrecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FichePrecision_groupeId_idx" ON "FichePrecision"("groupeId");

-- CreateIndex
CREATE UNIQUE INDEX "FichePrecision_ficheId_groupeId_key" ON "FichePrecision"("ficheId", "groupeId");

-- AddForeignKey
ALTER TABLE "FichePrecision" ADD CONSTRAINT "FichePrecision_ficheId_fkey" FOREIGN KEY ("ficheId") REFERENCES "Fiche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FichePrecision" ADD CONSTRAINT "FichePrecision_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "GroupeTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------- Reprise des données : familles (listes courtes) + précisions libres ----------

-- Matériau et Application : un seul choix par fiche
UPDATE "GroupeTag" SET "choixUnique" = true WHERE "slug" IN ('materiau', 'application');

-- « Autre » dans chaque groupe (quand aucune famille ne convient : la précision dit quoi)
INSERT INTO "Tag" ("id", "slug", "nom", "groupeId", "valide")
SELECT 'autre_' || g."id", 'autre', 'Autre', g."id", true FROM "GroupeTag" g
ON CONFLICT ("groupeId", "slug") DO UPDATE SET "valide" = true;

-- Tags à déplacer en précision : ceux proposés par les clients (non validés),
-- et dans un groupe à choix unique, les tags en trop (on garde le premier validé, par ordre alphabétique)
CREATE TEMP TABLE "_deplaces" AS
SELECT x."ficheId", x."tagId", x."nom", x."groupeId"
FROM (
  SELECT ft."ficheId", t."id" AS "tagId", t."nom", t."valide", t."groupeId", g."choixUnique",
         row_number() OVER (PARTITION BY ft."ficheId", t."groupeId" ORDER BY t."valide" DESC, (t."slug" = 'autre'), t."nom") AS rn
  FROM "FicheTag" ft
  JOIN "Tag" t ON t."id" = ft."tagId"
  JOIN "GroupeTag" g ON g."id" = t."groupeId"
) x
WHERE NOT x."valide" OR (x."choixUnique" AND x.rn > 1);

-- leurs noms deviennent la précision de la fiche dans ce groupe
INSERT INTO "FichePrecision" ("id", "ficheId", "groupeId", "texte")
SELECT 'prec_' || md5(d."ficheId" || d."groupeId"), d."ficheId", d."groupeId", left(string_agg(d."nom", ', ' ORDER BY d."nom"), 80)
FROM "_deplaces" d
GROUP BY d."ficheId", d."groupeId";

-- plus aucun tag validé dans ce groupe : la fiche passe en « Autre »
INSERT INTO "FicheTag" ("ficheId", "tagId")
SELECT DISTINCT d."ficheId", a."id"
FROM "_deplaces" d
JOIN "Tag" a ON a."groupeId" = d."groupeId" AND a."slug" = 'autre'
WHERE NOT EXISTS (
  SELECT 1 FROM "FicheTag" ft JOIN "Tag" t ON t."id" = ft."tagId"
  WHERE ft."ficheId" = d."ficheId" AND t."groupeId" = d."groupeId" AND t."valide"
    AND NOT EXISTS (SELECT 1 FROM "_deplaces" d2 WHERE d2."ficheId" = ft."ficheId" AND d2."tagId" = ft."tagId")
)
  AND NOT EXISTS (SELECT 1 FROM "_deplaces" d3 WHERE d3."ficheId" = d."ficheId" AND d3."tagId" = a."id")
ON CONFLICT DO NOTHING;

DELETE FROM "FicheTag" ft USING "_deplaces" d WHERE ft."ficheId" = d."ficheId" AND ft."tagId" = d."tagId";
DELETE FROM "Tag" t WHERE NOT t."valide" AND NOT EXISTS (SELECT 1 FROM "FicheTag" ft WHERE ft."tagId" = t."id");
DROP TABLE "_deplaces";
