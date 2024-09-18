/*
  Warnings:

  - You are about to drop the column `name` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Plan` table. All the data in the column will be lost.
  - Added the required column `amountPaid` to the `Plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `billingPeriod` to the `Plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currency` to the `Plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productId` to the `Plan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "name",
DROP COLUMN "type",
ADD COLUMN     "amountPaid" INTEGER NOT NULL,
ADD COLUMN     "billingPeriod" TEXT NOT NULL,
ADD COLUMN     "currency" TEXT NOT NULL,
ADD COLUMN     "productId" TEXT NOT NULL;
