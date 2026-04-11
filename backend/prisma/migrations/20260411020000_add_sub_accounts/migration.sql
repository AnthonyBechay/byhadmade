-- CreateTable: SubAccount
CREATE TABLE IF NOT EXISTS "SubAccount" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowedMenuIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "allowedRestaurantIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubAccount_ownerId_email_key" ON "SubAccount"("ownerId", "email");
CREATE INDEX IF NOT EXISTS "SubAccount_email_idx" ON "SubAccount"("email");

ALTER TABLE "SubAccount" DROP CONSTRAINT IF EXISTS "SubAccount_ownerId_fkey";
ALTER TABLE "SubAccount" ADD CONSTRAINT "SubAccount_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
