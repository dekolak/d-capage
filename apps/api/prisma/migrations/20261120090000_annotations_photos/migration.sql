-- AlterTable
ALTER TABLE "PhotoEtape" ADD COLUMN     "annotations" JSONB,
ADD COLUMN     "cleOriginale" TEXT,
ADD COLUMN     "majLe" TIMESTAMP(3);

