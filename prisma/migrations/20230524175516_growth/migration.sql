/*
  Warnings:

  - You are about to drop the column `Growth` on the `Trend` table. All the data in the column will be lost.
  - Added the required column `growth` to the `Trend` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Trend" DROP COLUMN "Growth",
ADD COLUMN     "growth" DOUBLE PRECISION NOT NULL;
