-- CreateTable
CREATE TABLE "CorrectionGuide" (
    "id" TEXT NOT NULL,
    "guide" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "valeur" JSONB NOT NULL DEFAULT '{}',
    "photoCle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorrectionGuide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CorrectionGuide_guide_type_cle_key" ON "CorrectionGuide"("guide", "type", "cle");

