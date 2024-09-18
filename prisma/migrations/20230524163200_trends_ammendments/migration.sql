/*
  Warnings:

  - You are about to drop the `Trends` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Trends" DROP CONSTRAINT "Trends_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Trends" DROP CONSTRAINT "Trends_subCategoryId_fkey";

-- DropForeignKey
ALTER TABLE "Trends" DROP CONSTRAINT "Trends_userId_fkey";

-- DropTable
DROP TABLE "Trends";

-- CreateTable
CREATE TABLE "Trend" (
    "id" SERIAL NOT NULL,
    "keyword" TEXT NOT NULL,
    "volumeIndex" INTEGER NOT NULL,
    "Growth" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "subCategoryId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trend_keyword_key" ON "Trend"("keyword");

-- AddForeignKey
ALTER TABLE "Trend" ADD CONSTRAINT "Trend_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trend" ADD CONSTRAINT "Trend_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "SubCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trend" ADD CONSTRAINT "Trend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
