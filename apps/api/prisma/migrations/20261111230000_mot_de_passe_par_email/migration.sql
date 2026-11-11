-- AlterTable
ALTER TABLE "DemandeMotDePasse" ADD COLUMN     "email" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "DemandeMotDePasse_email_createdAt_idx" ON "DemandeMotDePasse"("email", "createdAt");

