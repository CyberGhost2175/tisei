-- Add in_service status and service equipment registry

ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'in_service';

CREATE TYPE "ServiceEquipmentStatus" AS ENUM ('in_service', 'returned');

ALTER TABLE "requests" ADD COLUMN IF NOT EXISTS "equipmentCategoryText" TEXT;

CREATE TABLE "service_equipment" (
    "id" TEXT NOT NULL,
    "companyOrFullName" TEXT NOT NULL,
    "partnerEstablishmentId" TEXT,
    "equipmentCategoryId" TEXT,
    "equipmentCategoryText" TEXT,
    "equipmentName" TEXT,
    "problemDescription" TEXT,
    "requestId" TEXT,
    "status" "ServiceEquipmentStatus" NOT NULL DEFAULT 'in_service',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_equipment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_equipment_requestId_key" ON "service_equipment"("requestId");
CREATE INDEX "service_equipment_status_idx" ON "service_equipment"("status");
CREATE INDEX "service_equipment_companyOrFullName_idx" ON "service_equipment"("companyOrFullName");
CREATE INDEX "service_equipment_partnerEstablishmentId_idx" ON "service_equipment"("partnerEstablishmentId");

ALTER TABLE "service_equipment" ADD CONSTRAINT "service_equipment_partnerEstablishmentId_fkey" FOREIGN KEY ("partnerEstablishmentId") REFERENCES "partner_establishments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_equipment" ADD CONSTRAINT "service_equipment_equipmentCategoryId_fkey" FOREIGN KEY ("equipmentCategoryId") REFERENCES "equipment_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_equipment" ADD CONSTRAINT "service_equipment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
