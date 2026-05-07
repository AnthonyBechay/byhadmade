-- CreateEnum: TempUnit
CREATE TYPE "TempUnit" AS ENUM ('CELSIUS', 'FAHRENHEIT');

-- CreateEnum: TempDeviceType
CREATE TYPE "TempDeviceType" AS ENUM ('FRIDGE', 'FREEZER', 'COLD_ROOM', 'WINE_CELLAR', 'OVEN', 'WARMER', 'OTHER');

-- CreateTable: TempDevice
CREATE TABLE "TempDevice" (
    "id"         TEXT            NOT NULL,
    "userId"     TEXT            NOT NULL,
    "name"       TEXT            NOT NULL,
    "location"   TEXT,
    "deviceType" "TempDeviceType" NOT NULL DEFAULT 'FRIDGE',
    "minTemp"    DOUBLE PRECISION NOT NULL,
    "maxTemp"    DOUBLE PRECISION NOT NULL,
    "targetTemp" DOUBLE PRECISION,
    "unit"       "TempUnit"      NOT NULL DEFAULT 'CELSIUS',
    "notes"      TEXT,
    "isActive"   BOOLEAN         NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3)    NOT NULL,
    CONSTRAINT "TempDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TempLog
CREATE TABLE "TempLog" (
    "id"           TEXT             NOT NULL,
    "deviceId"     TEXT             NOT NULL,
    "userId"       TEXT             NOT NULL,
    "date"         TIMESTAMP(3)     NOT NULL,
    "temp"         DOUBLE PRECISION NOT NULL,
    "isAutoFilled" BOOLEAN          NOT NULL DEFAULT false,
    "notes"        TEXT,
    "loggedAt"     TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TempLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "TempDevice_userId_idx" ON "TempDevice"("userId");
CREATE UNIQUE INDEX "TempLog_deviceId_date_key" ON "TempLog"("deviceId", "date");
CREATE INDEX "TempLog_userId_date_idx" ON "TempLog"("userId", "date");
CREATE INDEX "TempLog_deviceId_date_idx" ON "TempLog"("deviceId", "date");

-- Foreign Keys
ALTER TABLE "TempDevice"
    ADD CONSTRAINT "TempDevice_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TempLog"
    ADD CONSTRAINT "TempLog_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "TempDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TempLog"
    ADD CONSTRAINT "TempLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
