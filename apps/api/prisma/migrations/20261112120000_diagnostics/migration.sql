-- AlterTable
ALTER TABLE "EtapeProcedure" ADD COLUMN     "brancheId" TEXT,
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "Procedure" ADD COLUMN     "description" TEXT,
ADD COLUMN     "prompt" TEXT,
ADD COLUMN     "resumeIa" TEXT,
ADD COLUMN     "resumeIaLe" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ChoixEtape" (
    "id" TEXT NOT NULL,
    "etapeId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "signification" TEXT,
    "suite" TEXT NOT NULL DEFAULT 'retour',
    "etapeCibleId" TEXT,
    "conclusion" TEXT,
    "solutionId" TEXT,
    "procedureCibleId" TEXT,

    CONSTRAINT "ChoixEtape_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticEnvoye" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resultat" JSONB NOT NULL,
    "texte" TEXT NOT NULL,
    "message" TEXT,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticEnvoye_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChoixEtape_etapeId_ordre_idx" ON "ChoixEtape"("etapeId", "ordre");

-- CreateIndex
CREATE INDEX "DiagnosticEnvoye_createdAt_idx" ON "DiagnosticEnvoye"("createdAt");

-- AddForeignKey
ALTER TABLE "EtapeProcedure" ADD CONSTRAINT "EtapeProcedure_brancheId_fkey" FOREIGN KEY ("brancheId") REFERENCES "ChoixEtape"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoixEtape" ADD CONSTRAINT "ChoixEtape_etapeId_fkey" FOREIGN KEY ("etapeId") REFERENCES "EtapeProcedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoixEtape" ADD CONSTRAINT "ChoixEtape_etapeCibleId_fkey" FOREIGN KEY ("etapeCibleId") REFERENCES "EtapeProcedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoixEtape" ADD CONSTRAINT "ChoixEtape_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "Solution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoixEtape" ADD CONSTRAINT "ChoixEtape_procedureCibleId_fkey" FOREIGN KEY ("procedureCibleId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticEnvoye" ADD CONSTRAINT "DiagnosticEnvoye_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticEnvoye" ADD CONSTRAINT "DiagnosticEnvoye_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

