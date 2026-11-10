-- CreateTable
CREATE TABLE "Procedure" (
    "id" TEXT NOT NULL,
    "cle" TEXT,
    "titre" TEXT NOT NULL,
    "categorie" TEXT NOT NULL DEFAULT 'Impression',
    "resume" TEXT,
    "module" TEXT NOT NULL DEFAULT 'procedures-kiavik',
    "publiee" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Procedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtapeProcedure" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "texte" TEXT NOT NULL,
    "avertissement" TEXT,
    "photoCle" TEXT,
    "photoMaj" TIMESTAMP(3),
    "guide" TEXT,
    "ecran" TEXT,
    "pastille" TEXT,

    CONSTRAINT "EtapeProcedure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Procedure_cle_key" ON "Procedure"("cle");

-- CreateIndex
CREATE INDEX "EtapeProcedure_procedureId_ordre_idx" ON "EtapeProcedure"("procedureId", "ordre");

-- AddForeignKey
ALTER TABLE "EtapeProcedure" ADD CONSTRAINT "EtapeProcedure_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

