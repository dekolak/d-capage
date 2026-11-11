-- AlterTable
ALTER TABLE "Procedure" ADD COLUMN     "suivanteId" TEXT;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_suivanteId_fkey" FOREIGN KEY ("suivanteId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

