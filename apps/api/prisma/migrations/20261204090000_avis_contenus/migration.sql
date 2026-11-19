-- « C'était clair ? » en fin de contenu : désactivé partout au départ (rien à reprendre).
-- AlterTable
ALTER TABLE "CoursAcademie" ADD COLUMN     "demanderAvis" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Procedure" ADD COLUMN     "demanderAvis" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AvisContenu" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contenuId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clair" BOOLEAN NOT NULL,
    "commentaire" TEXT,
    "traite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvisContenu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvisContenu_traite_idx" ON "AvisContenu"("traite");

-- CreateIndex
CREATE UNIQUE INDEX "AvisContenu_type_contenuId_userId_key" ON "AvisContenu"("type", "contenuId", "userId");

-- AddForeignKey
ALTER TABLE "AvisContenu" ADD CONSTRAINT "AvisContenu_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

