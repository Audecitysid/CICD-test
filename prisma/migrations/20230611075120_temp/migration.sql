/*
  Warnings:

  - You are about to drop the column `searchesRemainings` on the `Plan` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "searchesRemainings",
ADD COLUMN     "allotedSearchRemainings" INTEGER,
ADD COLUMN     "totalSearches" INTEGER,
ADD COLUMN     "totalSearchesRemainings" INTEGER,
ALTER COLUMN "searchesAlloted" DROP NOT NULL;
