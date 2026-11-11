-- AlterTable
ALTER TABLE "EtapeProcedure" ADD COLUMN     "controle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "solutionId" TEXT;

-- AddForeignKey
ALTER TABLE "EtapeProcedure" ADD CONSTRAINT "EtapeProcedure_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "Solution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

