-- Split the single daily temperature reading into two readings: opening and closing.

-- Add the new nullable columns
ALTER TABLE "TempLog" ADD COLUMN "openTemp" DOUBLE PRECISION;
ALTER TABLE "TempLog" ADD COLUMN "closeTemp" DOUBLE PRECISION;

-- Migrate existing single readings into the opening reading
UPDATE "TempLog" SET "openTemp" = "temp";

-- Drop the old single-reading column
ALTER TABLE "TempLog" DROP COLUMN "temp";
