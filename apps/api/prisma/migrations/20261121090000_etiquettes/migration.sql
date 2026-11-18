-- AlterTable
ALTER TABLE "Modele" ADD COLUMN     "etiquettes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Procedure" ADD COLUMN     "espace" TEXT NOT NULL DEFAULT 'kiavik',
ADD COLUMN     "etiquettes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Solution" ADD COLUMN     "espace" TEXT NOT NULL DEFAULT 'kiavik',
ADD COLUMN     "etiquettes" TEXT[] DEFAULT ARRAY[]::TEXT[];

