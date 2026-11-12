-- DropForeignKey
ALTER TABLE "Modele" DROP CONSTRAINT "Modele_technologieId_fkey";

-- AlterTable
ALTER TABLE "Modele" ADD COLUMN     "espaces" TEXT[] DEFAULT ARRAY['lazzeko']::TEXT[],
ALTER COLUMN "technologieId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UserMachine" ADD COLUMN     "miseEnService" TIMESTAMP(3),
ADD COLUMN     "numeroSerie" TEXT;

-- AddForeignKey
ALTER TABLE "Modele" ADD CONSTRAINT "Modele_technologieId_fkey" FOREIGN KEY ("technologieId") REFERENCES "Technologie"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Reprise : les machines existantes ont été ajoutées le jour de leur création.
UPDATE "UserMachine" SET "miseEnService" = "createdAt" WHERE "miseEnService" IS NULL;
