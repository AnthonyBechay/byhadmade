-- Add userId columns as nullable first
ALTER TABLE "Category" ADD COLUMN "userId" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN "userId" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "userId" TEXT;
ALTER TABLE "Menu" ADD COLUMN "userId" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "userId" TEXT;

-- Assign all existing data to the first user (admin)
UPDATE "Category" SET "userId" = (SELECT id FROM "User" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Ingredient" SET "userId" = (SELECT id FROM "User" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Recipe" SET "userId" = (SELECT id FROM "User" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Menu" SET "userId" = (SELECT id FROM "User" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Restaurant" SET "userId" = (SELECT id FROM "User" LIMIT 1) WHERE "userId" IS NULL;

-- Make columns required
ALTER TABLE "Category" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Ingredient" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Recipe" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Menu" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Restaurant" ALTER COLUMN "userId" SET NOT NULL;

-- Drop old unique constraint on Category.name and Ingredient.name
DROP INDEX IF EXISTS "Category_name_key";
DROP INDEX IF EXISTS "Ingredient_name_key";

-- Add new unique constraints scoped to user
CREATE UNIQUE INDEX "Category_name_userId_key" ON "Category"("name", "userId");
CREATE UNIQUE INDEX "Ingredient_name_userId_key" ON "Ingredient"("name", "userId");

-- Add foreign keys
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
