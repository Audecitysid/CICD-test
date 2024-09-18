-- AlterTable
ALTER TABLE "Graph" ADD COLUMN     "aiStrength" TEXT,
ADD COLUMN     "volumeGrowth" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "History" ADD COLUMN     "aiStrength" TEXT,
ADD COLUMN     "goal" TEXT,
ADD COLUMN     "region" TEXT;
