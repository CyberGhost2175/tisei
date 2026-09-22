-- AlterTable PartnerLocation: equipment qty + per-point TO price
ALTER TABLE "partner_locations"
  ADD COLUMN "equipmentQuantity" INTEGER,
  ADD COLUMN "maintenancePrice" DECIMAL(14,2);

-- AlterTable PartnerEstablishment: price includes VAT flag
ALTER TABLE "partner_establishments"
  ADD COLUMN "maintenancePriceIncludesVat" BOOLEAN NOT NULL DEFAULT true;

UPDATE "partner_establishments"
SET "maintenancePriceIncludesVat" = false
WHERE "name" ILIKE '%golpas%';
