-- Annotateur unifié : repères animés des photos d'étape ; original et calque des images de l'Académie (rien à reprendre : colonnes vides).
-- AlterTable
ALTER TABLE "FichierAcademie" ADD COLUMN     "annotations" JSONB,
ADD COLUMN     "cleOriginale" TEXT,
ADD COLUMN     "majLe" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PhotoEtape" ADD COLUMN     "reperes" JSONB;

