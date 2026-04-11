-- Rename Receipt.receiptDate to Receipt.receivedAt (stores date + time now)
ALTER TABLE "Receipt" RENAME COLUMN "receiptDate" TO "receivedAt";

-- Rename the composite index
ALTER INDEX IF EXISTS "Receipt_userId_receiptDate_idx" RENAME TO "Receipt_userId_receivedAt_idx";
