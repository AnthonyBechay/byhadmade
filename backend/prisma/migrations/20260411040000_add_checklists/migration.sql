-- CreateEnum
CREATE TYPE "ChecklistType" AS ENUM ('OPENING', 'CLOSING', 'CUSTOM');

-- CreateTable: ChecklistTemplate
CREATE TABLE "ChecklistTemplate" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "type"      "ChecklistType" NOT NULL DEFAULT 'CUSTOM',
    "theme"     TEXT,
    "isActive"  BOOLEAN      NOT NULL DEFAULT true,
    "sortOrder" INTEGER      NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ChecklistTemplateItem
CREATE TABLE "ChecklistTemplateItem" (
    "id"         TEXT         NOT NULL,
    "templateId" TEXT         NOT NULL,
    "label"      TEXT         NOT NULL,
    "notes"      TEXT,
    "order"      INTEGER      NOT NULL DEFAULT 0,
    "required"   BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ChecklistRun
CREATE TABLE "ChecklistRun" (
    "id"         TEXT         NOT NULL,
    "templateId" TEXT         NOT NULL,
    "userId"     TEXT         NOT NULL,
    "date"       TIMESTAMP(3) NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChecklistRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ChecklistRunItem
CREATE TABLE "ChecklistRunItem" (
    "id"             TEXT         NOT NULL,
    "runId"          TEXT         NOT NULL,
    "templateItemId" TEXT         NOT NULL,
    "label"          TEXT         NOT NULL,
    "notes"          TEXT,
    "required"       BOOLEAN      NOT NULL DEFAULT true,
    "order"          INTEGER      NOT NULL DEFAULT 0,
    "checked"        BOOLEAN      NOT NULL DEFAULT false,
    "checkedAt"      TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChecklistRunItem_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "ChecklistTemplate_userId_type_idx" ON "ChecklistTemplate"("userId", "type");
CREATE UNIQUE INDEX "ChecklistRun_templateId_date_key" ON "ChecklistRun"("templateId", "date");
CREATE INDEX "ChecklistRun_userId_date_idx" ON "ChecklistRun"("userId", "date");

-- Foreign Keys
ALTER TABLE "ChecklistTemplate"
    ADD CONSTRAINT "ChecklistTemplate_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistTemplateItem"
    ADD CONSTRAINT "ChecklistTemplateItem_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistRun"
    ADD CONSTRAINT "ChecklistRun_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistRun"
    ADD CONSTRAINT "ChecklistRun_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistRunItem"
    ADD CONSTRAINT "ChecklistRunItem_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "ChecklistRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
