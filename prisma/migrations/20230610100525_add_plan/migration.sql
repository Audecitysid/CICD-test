/*
  Warnings:

  - You are about to drop the column `searchesAlloted` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `searchesRemainings` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionDuration` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionName` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[planId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "searchesAlloted",
DROP COLUMN "searchesRemainings",
DROP COLUMN "subscriptionDuration",
DROP COLUMN "subscriptionName",
ADD COLUMN     "planId" INTEGER;

-- CreateTable
CREATE TABLE "Plan" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "searchesAlloted" INTEGER NOT NULL,
    "searchesRemainings" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_planId_key" ON "User"("planId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
