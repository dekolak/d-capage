-- AlterTable
ALTER TABLE "PlanEntretien" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[];

