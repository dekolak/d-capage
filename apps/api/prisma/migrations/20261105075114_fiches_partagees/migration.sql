-- AlterTable
ALTER TABLE "Fiche" ALTER COLUMN "visibilite" SET DEFAULT 'PARTAGEE';

-- Mise en commun : toutes les fiches existantes deviennent partagées.
UPDATE "Fiche" SET "visibilite" = 'PARTAGEE';
