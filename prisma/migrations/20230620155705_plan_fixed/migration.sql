/*
  Warnings:

  - You are about to drop the column `userId` on the `Plan` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Plan" DROP CONSTRAINT "Plan_userId_fkey";

-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "userId";
