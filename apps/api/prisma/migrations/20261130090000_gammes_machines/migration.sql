-- AlterTable
ALTER TABLE "Modele" ADD COLUMN     "gamme" TEXT;


-- ---------- Classement des modèles existants (sûr seulement ; le reste reste « à classer » dans Machines) ----------
-- catégorie déjà donnée, un seul espace
UPDATE "Modele" SET "gamme" = 'lazzeko-decapeuse' WHERE "espaces" = ARRAY['lazzeko'] AND lower(trim("categorie")) IN ('décapeuse', 'decapeuse');
UPDATE "Modele" SET "gamme" = 'lazzeko-soudeuse' WHERE "espaces" = ARRAY['lazzeko'] AND lower(trim("categorie")) = 'soudeuse';
UPDATE "Modele" SET "gamme" = 'lazzeko-accessoire' WHERE "espaces" = ARRAY['lazzeko'] AND lower(trim("categorie")) = 'accessoire';
UPDATE "Modele" SET "gamme" = 'kiavik-imprimante' WHERE "espaces" = ARRAY['kiavik'] AND lower(trim("categorie")) = 'imprimante';
UPDATE "Modele" SET "gamme" = 'kiavik-accessoire' WHERE "espaces" = ARRAY['kiavik'] AND lower(trim("categorie")) = 'accessoire';
-- sans catégorie : nettoyeur laser avec écran de réglage = décapeuse ; Kiavik = imprimante
UPDATE "Modele" SET "gamme" = 'lazzeko-decapeuse' WHERE "gamme" IS NULL AND "categorie" IS NULL AND "espaces" = ARRAY['lazzeko'] AND "technologieId" IS NOT NULL;
UPDATE "Modele" SET "gamme" = 'kiavik-imprimante' WHERE "gamme" IS NULL AND "categorie" IS NULL AND "espaces" = ARRAY['kiavik'];
-- la gamme donne l'espace et la catégorie (écriture normalisée)
UPDATE "Modele" SET "espaces" = ARRAY['lazzeko'], "categorie" = 'Décapeuse' WHERE "gamme" = 'lazzeko-decapeuse';
UPDATE "Modele" SET "espaces" = ARRAY['lazzeko'], "categorie" = 'Soudeuse' WHERE "gamme" = 'lazzeko-soudeuse';
UPDATE "Modele" SET "espaces" = ARRAY['lazzeko'], "categorie" = 'Accessoire' WHERE "gamme" = 'lazzeko-accessoire';
UPDATE "Modele" SET "espaces" = ARRAY['kiavik'], "categorie" = 'Imprimante' WHERE "gamme" = 'kiavik-imprimante';
UPDATE "Modele" SET "espaces" = ARRAY['kiavik'], "categorie" = 'Accessoire' WHERE "gamme" = 'kiavik-accessoire';
