-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ReceiptStatus" AS ENUM ('PENDING', 'CONFIRMED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: Receipt
CREATE TABLE IF NOT EXISTS "Receipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplier" TEXT,
    "total" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "photoUrl" TEXT NOT NULL,
    "rawText" TEXT,
    "notes" TEXT,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Receipt_userId_receiptDate_idx" ON "Receipt"("userId", "receiptDate");
ALTER TABLE "Receipt" DROP CONSTRAINT IF EXISTS "Receipt_userId_fkey";
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ReceiptItem
CREATE TABLE IF NOT EXISTS "ReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "unitPrice" DOUBLE PRECISION,
    "total" DOUBLE PRECISION,
    "notes" TEXT,
    CONSTRAINT "ReceiptItem_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ReceiptItem" DROP CONSTRAINT IF EXISTS "ReceiptItem_receiptId_fkey";
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "ReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
