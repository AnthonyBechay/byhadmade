-- AlterTable: Add shareToken column as nullable first
ALTER TABLE "Restaurant" ADD COLUMN "shareToken" TEXT;

-- Populate existing rows with unique values
UPDATE "Restaurant" SET "shareToken" = gen_random_uuid()::text WHERE "shareToken" IS NULL;

-- Make column required
ALTER TABLE "Restaurant" ALTER COLUMN "shareToken" SET NOT NULL;

-- Set default for future rows
ALTER TABLE "Restaurant" ALTER COLUMN "shareToken" SET DEFAULT gen_random_uuid()::text;

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_shareToken_key" ON "Restaurant"("shareToken");
