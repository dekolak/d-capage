-- AlterTable
ALTER TABLE "Annonce" ADD COLUMN     "dateQuestion" TEXT,
ADD COLUMN     "dateSi" TEXT,
ADD COLUMN     "procedureId" TEXT;

-- AlterTable
ALTER TABLE "AnnonceReponse" ADD COLUMN     "dateFaite" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ParcoursTermine" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "annonceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcoursTermine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParcoursTermine_userId_createdAt_idx" ON "ParcoursTermine"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Annonce" ADD CONSTRAINT "Annonce_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcoursTermine" ADD CONSTRAINT "ParcoursTermine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcoursTermine" ADD CONSTRAINT "ParcoursTermine_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcoursTermine" ADD CONSTRAINT "ParcoursTermine_annonceId_fkey" FOREIGN KEY ("annonceId") REFERENCES "Annonce"("id") ON DELETE SET NULL ON UPDATE CASCADE;

