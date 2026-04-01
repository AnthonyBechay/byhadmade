-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_userId_key" ON "Supplier"("name", "userId");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add purchasing fields to Ingredient
ALTER TABLE "Ingredient" ADD COLUMN "supplier" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN "purchaseUnit" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN "purchaseQty" DOUBLE PRECISION;
ALTER TABLE "Ingredient" ADD COLUMN "unitPrice" DOUBLE PRECISION;
ALTER TABLE "Ingredient" ADD COLUMN "currency" TEXT DEFAULT 'USD';
ALTER TABLE "Ingredient" ADD COLUMN "minStock" DOUBLE PRECISION;
ALTER TABLE "Ingredient" ADD COLUMN "notes" TEXT;

-- AlterTable: Link OrderItem to Ingredient
ALTER TABLE "OrderItem" ADD COLUMN "ingredientId" TEXT;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
