/*
  Warnings:

  - You are about to drop the column `Growth` on the `Trend` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Plan" ALTER COLUMN "amountPaid" DROP NOT NULL,
ALTER COLUMN "amountPaid" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Trend" DROP COLUMN "Growth",
ADD COLUMN     "growthInNumber" DOUBLE PRECISION,
ALTER COLUMN "growth" SET DATA TYPE TEXT;
