-- AlterTable
ALTER TABLE "Modele" ADD COLUMN     "categorie" TEXT;

-- AlterTable
ALTER TABLE "Procedure" ADD COLUMN     "cibleCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cibleModeles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Solution" ADD COLUMN     "cibleCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cibleModeles" TEXT[] DEFAULT ARRAY[]::TEXT[];

