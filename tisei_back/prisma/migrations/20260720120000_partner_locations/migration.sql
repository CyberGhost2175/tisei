-- CreateTable
CREATE TABLE "partner_locations" (
    "id" TEXT NOT NULL,
    "partnerEstablishmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Астана',
    "address" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_locations_partnerEstablishmentId_idx" ON "partner_locations"("partnerEstablishmentId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_locations_partnerEstablishmentId_name_key" ON "partner_locations"("partnerEstablishmentId", "name");

-- AddForeignKey
ALTER TABLE "partner_locations" ADD CONSTRAINT "partner_locations_partnerEstablishmentId_fkey" FOREIGN KEY ("partnerEstablishmentId") REFERENCES "partner_establishments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
