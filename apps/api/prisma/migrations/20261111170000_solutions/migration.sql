-- CreateTable
CREATE TABLE "Solution" (
    "id" TEXT NOT NULL,
    "cle" TEXT,
    "titre" TEXT NOT NULL,
    "categorie" TEXT NOT NULL DEFAULT 'Impression',
    "cause" TEXT,
    "texte" TEXT NOT NULL,
    "avertissement" TEXT,
    "motsCles" TEXT[],
    "guide" TEXT,
    "ecran" TEXT,
    "pastille" TEXT,
    "procedureId" TEXT,
    "photoCle" TEXT,
    "photoMaj" TIMESTAMP(3),
    "module" TEXT NOT NULL DEFAULT 'procedures-kiavik',
    "publiee" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Solution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Solution_cle_key" ON "Solution"("cle");

