-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "userMachineId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'distance',
    "date" TIMESTAMP(3) NOT NULL,
    "dureeMinutes" INTEGER,
    "technicien" TEXT,
    "motif" TEXT NOT NULL,
    "travaux" TEXT,
    "pieces" TEXT,
    "resultat" TEXT NOT NULL DEFAULT 'repare',
    "visibleClient" BOOLEAN NOT NULL DEFAULT true,
    "diagnosticId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoIntervention" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "cle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Intervention_numero_key" ON "Intervention"("numero");

-- CreateIndex
CREATE INDEX "Intervention_userMachineId_date_idx" ON "Intervention"("userMachineId", "date");

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_userMachineId_fkey" FOREIGN KEY ("userMachineId") REFERENCES "UserMachine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_diagnosticId_fkey" FOREIGN KEY ("diagnosticId") REFERENCES "DiagnosticEnvoye"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoIntervention" ADD CONSTRAINT "PhotoIntervention_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

