/*
  Warnings:

  - You are about to drop the column `isBreak` on the `Shift` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('WORK', 'BREAK', 'DAY_OFF', 'SICK', 'VACATION');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "color" TEXT,
ADD COLUMN     "hourlyRate" DOUBLE PRECISION,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "address" TEXT;

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "Shift" DROP COLUMN "isBreak",
ADD COLUMN     "shiftType" "ShiftType" NOT NULL DEFAULT 'WORK';
