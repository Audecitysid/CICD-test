/*
  Warnings:

  - Made the column `searchesAlloted` on table `Plan` required. This step will fail if there are existing NULL values in that column.
  - Made the column `allotedSearchRemainings` on table `Plan` required. This step will fail if there are existing NULL values in that column.
  - Made the column `totalSearches` on table `Plan` required. This step will fail if there are existing NULL values in that column.
  - Made the column `totalSearchesRemainings` on table `Plan` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Plan" ALTER COLUMN "searchesAlloted" SET NOT NULL,
ALTER COLUMN "allotedSearchRemainings" SET NOT NULL,
ALTER COLUMN "totalSearches" SET NOT NULL,
ALTER COLUMN "totalSearchesRemainings" SET NOT NULL;
