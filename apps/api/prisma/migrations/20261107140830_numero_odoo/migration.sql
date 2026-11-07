-- AlterTable
ALTER TABLE "Annonce" ADD COLUMN     "numerosOdoo" TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "numeroOdoo" TEXT;

-- CreateIndex
CREATE INDEX "User_numeroOdoo_idx" ON "User"("numeroOdoo");
