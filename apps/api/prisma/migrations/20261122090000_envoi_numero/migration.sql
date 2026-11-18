-- AlterTable
ALTER TABLE "Procedure" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'procedure';

-- AlterTable
ALTER TABLE "UserMachine" ADD COLUMN     "numero" INTEGER;

-- CreateTable
CREATE TABLE "EnvoiPasAPas" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "userMachineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "auteur" TEXT NOT NULL,
    "message" TEXT,
    "vuLe" TIMESTAMP(3),
    "ouvertLe" TIMESTAMP(3),
    "termineLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvoiPasAPas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnvoiPasAPas_userId_createdAt_idx" ON "EnvoiPasAPas"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserMachine_numero_key" ON "UserMachine"("numero");

-- AddForeignKey
ALTER TABLE "EnvoiPasAPas" ADD CONSTRAINT "EnvoiPasAPas_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvoiPasAPas" ADD CONSTRAINT "EnvoiPasAPas_userMachineId_fkey" FOREIGN KEY ("userMachineId") REFERENCES "UserMachine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvoiPasAPas" ADD CONSTRAINT "EnvoiPasAPas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Reprise : n° courts des machines existantes (621, 622… dans l'ordre d'ajout).
UPDATE "UserMachine" u SET "numero" = n.num
FROM (SELECT "id", 620 + ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS num FROM "UserMachine") n
WHERE u."id" = n."id";

-- Reprise : type des pas-à-pas existants (avec questions = dépannage ; catégorie Entretien = entretien).
UPDATE "Procedure" SET "type" = 'entretien' WHERE "categorie" = 'Entretien';
UPDATE "Procedure" SET "type" = 'depannage' WHERE "id" IN (
  SELECT e."procedureId" FROM "EtapeProcedure" e JOIN "ChoixEtape" c ON c."etapeId" = e."id"
);
