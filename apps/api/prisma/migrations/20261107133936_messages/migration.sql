-- CreateEnum
CREATE TYPE "NiveauAnnonce" AS ENUM ('CONSEIL', 'INFO', 'IMPORTANT');

-- CreateEnum
CREATE TYPE "Recurrence" AS ENUM ('AUCUNE', 'JOURS', 'SEMAINES', 'MOIS');

-- CreateEnum
CREATE TYPE "CibleClient" AS ENUM ('TOUS', 'LAZZEKO', 'AUTRES');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clientLazzeko" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Annonce" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "niveau" "NiveauAnnonce" NOT NULL DEFAULT 'INFO',
    "lienUrl" TEXT,
    "lienTexte" TEXT,
    "debut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "recurrence" "Recurrence" NOT NULL DEFAULT 'AUCUNE',
    "intervalle" INTEGER NOT NULL DEFAULT 1,
    "cibleClient" "CibleClient" NOT NULL DEFAULT 'TOUS',
    "fabricantIds" TEXT[],
    "modeleIds" TEXT[],
    "varianteIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Annonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnonceLecture" (
    "annonceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "occurrence" INTEGER NOT NULL,
    "vueLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "compriseLe" TIMESTAMP(3),

    CONSTRAINT "AnnonceLecture_pkey" PRIMARY KEY ("annonceId","userId","occurrence")
);

-- AddForeignKey
ALTER TABLE "AnnonceLecture" ADD CONSTRAINT "AnnonceLecture_annonceId_fkey" FOREIGN KEY ("annonceId") REFERENCES "Annonce"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnonceLecture" ADD CONSTRAINT "AnnonceLecture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
