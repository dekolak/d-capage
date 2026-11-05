-- AlterTable
ALTER TABLE "Fiche" ADD COLUMN     "nbNotes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "noteMoyenne" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Fiche_visibilite_noteMoyenne_idx" ON "Fiche"("visibilite", "noteMoyenne");
