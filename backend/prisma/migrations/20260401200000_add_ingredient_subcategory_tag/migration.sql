-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "subcategory" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "tag" TEXT;
