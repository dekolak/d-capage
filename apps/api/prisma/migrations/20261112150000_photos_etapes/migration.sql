-- Plusieurs photos par étape : nouvelle table, reprise de la photo existante de chaque étape (en premier), puis suppression des anciennes colonnes.

-- CreateTable
CREATE TABLE "PhotoEtape" (
    "id" TEXT NOT NULL,
    "etapeId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "cle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoEtape_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoEtape_etapeId_ordre_idx" ON "PhotoEtape"("etapeId", "ordre");

-- AddForeignKey
ALTER TABLE "PhotoEtape" ADD CONSTRAINT "PhotoEtape_etapeId_fkey" FOREIGN KEY ("etapeId") REFERENCES "EtapeProcedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise des photos existantes
INSERT INTO "PhotoEtape" ("id", "etapeId", "ordre", "cle", "createdAt")
SELECT 'ph' || "id", "id", 0, "photoCle", COALESCE("photoMaj", CURRENT_TIMESTAMP)
FROM "EtapeProcedure"
WHERE "photoCle" IS NOT NULL;

-- AlterTable
ALTER TABLE "EtapeProcedure" DROP COLUMN "photoCle",
DROP COLUMN "photoMaj";
