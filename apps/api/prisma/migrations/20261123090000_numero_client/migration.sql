-- DropForeignKey
ALTER TABLE "EnvoiPasAPas" DROP CONSTRAINT "EnvoiPasAPas_userMachineId_fkey";

-- DropIndex
DROP INDEX "UserMachine_numero_key";

-- AlterTable
ALTER TABLE "EnvoiPasAPas" ALTER COLUMN "userMachineId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "numero" INTEGER;

-- Reprise : n° client court (621, 622…) pour les clients (pas les admins), dans l'ordre de création des comptes.
UPDATE "User" u SET "numero" = n.num
FROM (SELECT "id", 620 + ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS num FROM "User" WHERE "role" = 'USER') n
WHERE u."id" = n."id";


-- AlterTable
ALTER TABLE "UserMachine" DROP COLUMN "numero";

-- CreateIndex
CREATE UNIQUE INDEX "User_numero_key" ON "User"("numero");

-- AddForeignKey
ALTER TABLE "EnvoiPasAPas" ADD CONSTRAINT "EnvoiPasAPas_userMachineId_fkey" FOREIGN KEY ("userMachineId") REFERENCES "UserMachine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

