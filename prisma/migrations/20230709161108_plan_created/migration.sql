/*
  Warnings:

  - Added the required column `timestampCreated` to the `Plan` table without a default value. This is not possible if the table is not empty.
  - Made the column `customerId` on table `Plan` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "timestampCreated" INTEGER NOT NULL,
ALTER COLUMN "customerId" SET NOT NULL;
