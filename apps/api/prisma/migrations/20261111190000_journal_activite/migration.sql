-- CreateTable
CREATE TABLE "Activite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "espace" TEXT,
    "type" TEXT NOT NULL,
    "chemin" TEXT,
    "detail" TEXT,
    "resultats" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activite_userId_createdAt_idx" ON "Activite"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Activite_createdAt_idx" ON "Activite"("createdAt");

-- AddForeignKey
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

