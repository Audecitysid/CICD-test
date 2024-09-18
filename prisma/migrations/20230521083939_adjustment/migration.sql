/*
  Warnings:

  - You are about to drop the column `category` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `subCategory` on the `SubCategory` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `SubCategory` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `SubCategory` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Category_category_key";

-- DropIndex
DROP INDEX "SubCategory_subCategory_key";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "category",
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SubCategory" DROP COLUMN "subCategory",
ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SubCategory_name_key" ON "SubCategory"("name");
