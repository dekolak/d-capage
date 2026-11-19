-- AlterTable
ALTER TABLE "Fiche" ADD COLUMN     "univers" TEXT NOT NULL DEFAULT 'decapage';

-- AlterTable
ALTER TABLE "GroupeTag" ADD COLUMN     "univers" TEXT[] DEFAULT ARRAY[]::TEXT[];


-- Données existantes : toutes les fiches sont du décapage (défaut) ;
-- les groupes existants (Matériau, À enlever, Application) sont ceux du décapage.
UPDATE "GroupeTag" SET "univers" = ARRAY['decapage'] WHERE "slug" IN ('materiau', 'a-enlever', 'application');
