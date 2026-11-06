-- AlterTable
ALTER TABLE "Fiche" ADD COLUMN     "accordPhotos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "accordPhotosLe" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Modele" ADD COLUMN     "imageCle" TEXT,
ADD COLUMN     "imageMaj" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Variante" ADD COLUMN     "imageCle" TEXT,
ADD COLUMN     "imageMaj" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Parametre" (
    "cle" TEXT NOT NULL,
    "valeur" JSONB NOT NULL,
    "maj" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parametre_pkey" PRIMARY KEY ("cle")
);

-- CreateTable
CREATE TABLE "DemandeAide" (
    "id" TEXT NOT NULL,
    "ficheId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "traitee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandeAide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemandeAide_traitee_createdAt_idx" ON "DemandeAide"("traitee", "createdAt");

-- AddForeignKey
ALTER TABLE "DemandeAide" ADD CONSTRAINT "DemandeAide_ficheId_fkey" FOREIGN KEY ("ficheId") REFERENCES "Fiche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAide" ADD CONSTRAINT "DemandeAide_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
