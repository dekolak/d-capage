-- CreateEnum
CREATE TYPE "TypeQuestion" AS ENUM ('AUCUNE', 'OUI_NON', 'CHOIX', 'NOTE', 'TEXTE');

-- AlterTable
ALTER TABLE "Annonce" ADD COLUMN     "autreOption" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "options" TEXT[],
ADD COLUMN     "question" TEXT,
ADD COLUMN     "questionType" "TypeQuestion" NOT NULL DEFAULT 'AUCUNE',
ADD COLUMN     "reponseObligatoire" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AnnonceReponse" (
    "id" TEXT NOT NULL,
    "annonceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "occurrence" INTEGER NOT NULL,
    "valeur" TEXT NOT NULL,
    "autre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnonceReponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnnonceReponse_annonceId_userId_occurrence_key" ON "AnnonceReponse"("annonceId", "userId", "occurrence");

-- AddForeignKey
ALTER TABLE "AnnonceReponse" ADD CONSTRAINT "AnnonceReponse_annonceId_fkey" FOREIGN KEY ("annonceId") REFERENCES "Annonce"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnonceReponse" ADD CONSTRAINT "AnnonceReponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
