-- CreateEnum
CREATE TYPE "StatutAvis" AS ENUM ('VISIBLE', 'EN_ATTENTE', 'MASQUE');

-- CreateEnum
CREATE TYPE "StatutLivraison" AS ENUM ('EN_ATTENTE', 'ENVOYE', 'ECHEC');

-- AlterTable
ALTER TABLE "Evaluation" ADD COLUMN     "moderationRaison" TEXT,
ADD COLUMN     "modereLe" TIMESTAMP(3),
ADD COLUMN     "moderePar" TEXT,
ADD COLUMN     "statut" "StatutAvis" NOT NULL DEFAULT 'VISIBLE';

-- AlterTable
ALTER TABLE "Fiche" ADD COLUMN     "moderationRaison" TEXT,
ADD COLUMN     "moderePar" TEXT;

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "evenements" TEXT[],
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookLivraison" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "evenement" TEXT NOT NULL,
    "charge" JSONB NOT NULL,
    "statut" "StatutLivraison" NOT NULL DEFAULT 'EN_ATTENTE',
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "prochainEssai" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dernierCode" INTEGER,
    "derniereErreur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envoyeLe" TIMESTAMP(3),

    CONSTRAINT "WebhookLivraison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookLivraison_statut_prochainEssai_idx" ON "WebhookLivraison"("statut", "prochainEssai");

-- CreateIndex
CREATE INDEX "Evaluation_statut_updatedAt_idx" ON "Evaluation"("statut", "updatedAt");

-- AddForeignKey
ALTER TABLE "WebhookLivraison" ADD CONSTRAINT "WebhookLivraison_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
