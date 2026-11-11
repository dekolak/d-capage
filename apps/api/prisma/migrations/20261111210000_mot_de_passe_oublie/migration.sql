-- CreateTable
CREATE TABLE "DemandeMotDePasse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "codeHash" TEXT,
    "codeExpire" TIMESTAMP(3),
    "essais" INTEGER NOT NULL DEFAULT 0,
    "espace" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "traiteeLe" TIMESTAMP(3),

    CONSTRAINT "DemandeMotDePasse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbonnementPush" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbonnementPush_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemandeMotDePasse_userId_createdAt_idx" ON "DemandeMotDePasse"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DemandeMotDePasse_statut_idx" ON "DemandeMotDePasse"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "AbonnementPush_endpoint_key" ON "AbonnementPush"("endpoint");

-- AddForeignKey
ALTER TABLE "DemandeMotDePasse" ADD CONSTRAINT "DemandeMotDePasse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbonnementPush" ADD CONSTRAINT "AbonnementPush_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

