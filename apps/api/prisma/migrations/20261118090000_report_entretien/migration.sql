-- CreateTable
CREATE TABLE "ReportEntretien" (
    "id" TEXT NOT NULL,
    "userMachineId" TEXT NOT NULL,
    "tacheId" TEXT NOT NULL,
    "jusquau" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportEntretien_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportEntretien_userMachineId_tacheId_key" ON "ReportEntretien"("userMachineId", "tacheId");

-- AddForeignKey
ALTER TABLE "ReportEntretien" ADD CONSTRAINT "ReportEntretien_userMachineId_fkey" FOREIGN KEY ("userMachineId") REFERENCES "UserMachine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportEntretien" ADD CONSTRAINT "ReportEntretien_tacheId_fkey" FOREIGN KEY ("tacheId") REFERENCES "TacheEntretien"("id") ON DELETE CASCADE ON UPDATE CASCADE;

