-- AlterTable
ALTER TABLE "Fiche" DROP COLUMN "accordPhotos",
DROP COLUMN "accordPhotosLe";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accordPhotosMarketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "accordPhotosMarketingLe" TIMESTAMP(3),
ADD COLUMN     "conditionsAccepteesLe" TIMESTAMP(3),
ADD COLUMN     "conditionsVersion" INTEGER;

