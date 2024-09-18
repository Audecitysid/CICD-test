-- AlterTable
ALTER TABLE "Plan" ALTER COLUMN "expiresAt" DROP NOT NULL,
ALTER COLUMN "billingPeriod" DROP NOT NULL,
ALTER COLUMN "totalSearches" DROP NOT NULL,
ALTER COLUMN "totalSearchesRemainings" DROP NOT NULL;
