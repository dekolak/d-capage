-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "Visibilite" AS ENUM ('PRIVEE', 'PARTAGEE');

-- CreateEnum
CREATE TYPE "TypePhoto" AS ENUM ('AVANT', 'APRES', 'INTERFACE', 'AUTRE');

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "identifiant" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nom" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "organisationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prefixe" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "creeParId" TEXT,
    "derniereUtilisation" TIMESTAMP(3),
    "revoqueeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Technologie" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,

    CONSTRAINT "Technologie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fabricant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,

    CONSTRAINT "Fabricant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modele" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "fabricantId" TEXT NOT NULL,
    "technologieId" TEXT NOT NULL,

    CONSTRAINT "Modele_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variante" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "modeleId" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Variante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersionInterface" (
    "id" TEXT NOT NULL,
    "varianteId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "publiee" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersionInterface_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMachine" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "varianteId" TEXT NOT NULL,
    "surnom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMachine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupeTag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GroupeTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "groupeId" TEXT NOT NULL,
    "valide" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fiche" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userMachineId" TEXT,
    "versionInterfaceId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "commentaire" TEXT,
    "valeurs" JSONB NOT NULL,
    "visibilite" "Visibilite" NOT NULL DEFAULT 'PRIVEE',
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fiche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FicheTag" (
    "ficheId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "FicheTag_pkey" PRIMARY KEY ("ficheId","tagId")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "ficheId" TEXT NOT NULL,
    "type" "TypePhoto" NOT NULL,
    "cle" TEXT NOT NULL,
    "miniature" TEXT,
    "largeur" INTEGER,
    "hauteur" INTEGER,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "ficheId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" INTEGER NOT NULL,
    "avis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_identifiant_key" ON "User"("identifiant");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_prefixe_key" ON "ApiKey"("prefixe");

-- CreateIndex
CREATE UNIQUE INDEX "Technologie_slug_key" ON "Technologie"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Fabricant_slug_key" ON "Fabricant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Modele_fabricantId_slug_key" ON "Modele"("fabricantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Variante_modeleId_slug_key" ON "Variante"("modeleId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "VersionInterface_varianteId_numero_key" ON "VersionInterface"("varianteId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "UserMachine_userId_varianteId_surnom_key" ON "UserMachine"("userId", "varianteId", "surnom");

-- CreateIndex
CREATE UNIQUE INDEX "GroupeTag_slug_key" ON "GroupeTag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_groupeId_slug_key" ON "Tag"("groupeId", "slug");

-- CreateIndex
CREATE INDEX "Fiche_versionInterfaceId_visibilite_idx" ON "Fiche"("versionInterfaceId", "visibilite");

-- CreateIndex
CREATE INDEX "FicheTag_tagId_idx" ON "FicheTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_ficheId_userId_key" ON "Evaluation"("ficheId", "userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Modele" ADD CONSTRAINT "Modele_fabricantId_fkey" FOREIGN KEY ("fabricantId") REFERENCES "Fabricant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Modele" ADD CONSTRAINT "Modele_technologieId_fkey" FOREIGN KEY ("technologieId") REFERENCES "Technologie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variante" ADD CONSTRAINT "Variante_modeleId_fkey" FOREIGN KEY ("modeleId") REFERENCES "Modele"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionInterface" ADD CONSTRAINT "VersionInterface_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "Variante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMachine" ADD CONSTRAINT "UserMachine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMachine" ADD CONSTRAINT "UserMachine_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "Variante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "GroupeTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fiche" ADD CONSTRAINT "Fiche_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fiche" ADD CONSTRAINT "Fiche_userMachineId_fkey" FOREIGN KEY ("userMachineId") REFERENCES "UserMachine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fiche" ADD CONSTRAINT "Fiche_versionInterfaceId_fkey" FOREIGN KEY ("versionInterfaceId") REFERENCES "VersionInterface"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fiche" ADD CONSTRAINT "Fiche_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Fiche"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheTag" ADD CONSTRAINT "FicheTag_ficheId_fkey" FOREIGN KEY ("ficheId") REFERENCES "Fiche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheTag" ADD CONSTRAINT "FicheTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_ficheId_fkey" FOREIGN KEY ("ficheId") REFERENCES "Fiche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_ficheId_fkey" FOREIGN KEY ("ficheId") REFERENCES "Fiche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
