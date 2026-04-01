-- AlterTable: add deliveryType to Supplier
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "deliveryType" TEXT;

-- CreateTable: IngredientCategory
CREATE TABLE IF NOT EXISTS "IngredientCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IngredientCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IngredientCategory_name_userId_key" ON "IngredientCategory"("name", "userId");
ALTER TABLE "IngredientCategory" ADD CONSTRAINT "IngredientCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: IngredientSubcategory
CREATE TABLE IF NOT EXISTS "IngredientSubcategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IngredientSubcategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IngredientSubcategory_name_categoryId_key" ON "IngredientSubcategory"("name", "categoryId");
ALTER TABLE "IngredientSubcategory" ADD CONSTRAINT "IngredientSubcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "IngredientCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: IngredientTag
CREATE TABLE IF NOT EXISTS "IngredientTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IngredientTag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IngredientTag_name_userId_key" ON "IngredientTag"("name", "userId");
ALTER TABLE "IngredientTag" ADD CONSTRAINT "IngredientTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Implicit many-to-many _IngredientToIngredientTag
CREATE TABLE IF NOT EXISTS "_IngredientToIngredientTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_IngredientToIngredientTag_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX IF NOT EXISTS "_IngredientToIngredientTag_B_index" ON "_IngredientToIngredientTag"("B");
ALTER TABLE "_IngredientToIngredientTag" ADD CONSTRAINT "_IngredientToIngredientTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_IngredientToIngredientTag" ADD CONSTRAINT "_IngredientToIngredientTag_B_fkey" FOREIGN KEY ("B") REFERENCES "IngredientTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old tag column from Ingredient (data migration: old tag values are lost)
ALTER TABLE "Ingredient" DROP COLUMN IF EXISTS "tag";
