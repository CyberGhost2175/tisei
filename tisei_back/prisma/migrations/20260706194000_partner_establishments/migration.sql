-- CreateTable
CREATE TABLE "partner_establishments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_establishments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partner_establishments_name_key" ON "partner_establishments"("name");

-- AlterTable
ALTER TABLE "requests" ADD COLUMN "partnerEstablishmentId" TEXT;

-- CreateIndex
CREATE INDEX "requests_partnerEstablishmentId_idx" ON "requests"("partnerEstablishmentId");

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_partnerEstablishmentId_fkey" FOREIGN KEY ("partnerEstablishmentId") REFERENCES "partner_establishments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
