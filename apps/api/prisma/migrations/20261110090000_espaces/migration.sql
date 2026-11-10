-- Espaces (Lazzeko, Kiavik) : accès par module, conditions d'utilisation par espace.

-- AlterTable
ALTER TABLE "Annonce" ADD COLUMN     "espaces" TEXT[];

-- AlterTable
ALTER TABLE "DemandeAide" ADD COLUMN     "espace" TEXT NOT NULL DEFAULT 'lazzeko';

-- CreateTable
CREATE TABLE "UserModule" (
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserModule_pkey" PRIMARY KEY ("userId","module")
);

-- CreateTable
CREATE TABLE "AcceptationConditions" (
    "userId" TEXT NOT NULL,
    "espace" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "accepteeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcceptationConditions_pkey" PRIMARY KEY ("userId","espace")
);

-- CreateIndex
CREATE INDEX "UserModule_module_idx" ON "UserModule"("module");

-- AddForeignKey
ALTER TABLE "UserModule" ADD CONSTRAINT "UserModule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptationConditions" ADD CONSTRAINT "AcceptationConditions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Données : tous les comptes existants sont des comptes Lazzeko (module réglages décapage).
INSERT INTO "UserModule" ("userId", "module") SELECT "id", 'reglages-decapage' FROM "User" WHERE "role" = 'USER';

-- Les messages existants sont des messages Lazzeko.
UPDATE "Annonce" SET "espaces" = ARRAY['lazzeko'];

-- Les conditions déjà acceptées deviennent celles de l'espace Lazzeko.
INSERT INTO "AcceptationConditions" ("userId", "espace", "version", "accepteeLe")
SELECT "id", 'lazzeko', "conditionsVersion", COALESCE("conditionsAccepteesLe", CURRENT_TIMESTAMP)
FROM "User" WHERE "conditionsVersion" IS NOT NULL;

-- Texte et version des conditions : rangés sous la clé de l'espace Lazzeko.
INSERT INTO "Parametre" ("cle", "valeur", "maj")
SELECT 'conditions:lazzeko',
       jsonb_strip_nulls(jsonb_build_object(
         'version', COALESCE((SELECT "valeur" FROM "Parametre" WHERE "cle" = 'conditionsVersion'), '1'::jsonb),
         'texte', (SELECT "valeur" FROM "Parametre" WHERE "cle" = 'conditionsTexte'))),
       CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Parametre" WHERE "cle" IN ('conditionsVersion', 'conditionsTexte'))
ON CONFLICT ("cle") DO NOTHING;
DELETE FROM "Parametre" WHERE "cle" IN ('conditionsVersion', 'conditionsTexte');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "conditionsAccepteesLe",
DROP COLUMN "conditionsVersion";
