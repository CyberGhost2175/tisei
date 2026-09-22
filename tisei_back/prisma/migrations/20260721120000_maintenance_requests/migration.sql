-- CreateEnum
CREATE TYPE "RequestKind" AS ENUM ('repair', 'maintenance');

-- AlterTable PartnerEstablishment: maintenance config
ALTER TABLE "partner_establishments"
  ADD COLUMN "maintenanceEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maintenanceCloseDay" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "maintenanceUnitPrice" DECIMAL(14,2),
  ADD COLUMN "maintenanceCustomerName" TEXT,
  ADD COLUMN "maintenanceCustomerBin" TEXT,
  ADD COLUMN "maintenanceCustomerAddress" TEXT,
  ADD COLUMN "maintenanceContractNumber" TEXT,
  ADD COLUMN "maintenanceContractDate" TIMESTAMP(3),
  ADD COLUMN "maintenanceExecutorName" TEXT,
  ADD COLUMN "maintenanceExecutorBin" TEXT,
  ADD COLUMN "maintenanceExecutorAddress" TEXT;

-- CreateTable
CREATE TABLE "maintenance_period_settings" (
    "id" TEXT NOT NULL,
    "partnerEstablishmentId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "closeByDate" TIMESTAMP(3) NOT NULL,
    "actDate" TIMESTAMP(3),
    "actNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_period_settings_pkey" PRIMARY KEY ("id")
);

-- AlterTable Request
ALTER TABLE "requests"
  ADD COLUMN "kind" "RequestKind" NOT NULL DEFAULT 'repair',
  ADD COLUMN "partnerLocationId" TEXT,
  ADD COLUMN "maintenancePeriod" TEXT,
  ADD COLUMN "maintenanceFindings" TEXT,
  ADD COLUMN "fromMaintenanceRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_period_settings_partnerEstablishmentId_period_key"
  ON "maintenance_period_settings"("partnerEstablishmentId", "period");

CREATE INDEX "maintenance_period_settings_period_idx"
  ON "maintenance_period_settings"("period");

CREATE INDEX "requests_kind_idx" ON "requests"("kind");
CREATE INDEX "requests_partnerLocationId_idx" ON "requests"("partnerLocationId");
CREATE INDEX "requests_maintenancePeriod_idx" ON "requests"("maintenancePeriod");
CREATE INDEX "requests_fromMaintenanceRequestId_idx" ON "requests"("fromMaintenanceRequestId");

CREATE UNIQUE INDEX "requests_partnerLocationId_maintenancePeriod_kind_key"
  ON "requests"("partnerLocationId", "maintenancePeriod", "kind");

-- AddForeignKey
ALTER TABLE "maintenance_period_settings"
  ADD CONSTRAINT "maintenance_period_settings_partnerEstablishmentId_fkey"
  FOREIGN KEY ("partnerEstablishmentId") REFERENCES "partner_establishments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "requests"
  ADD CONSTRAINT "requests_partnerLocationId_fkey"
  FOREIGN KEY ("partnerLocationId") REFERENCES "partner_locations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "requests"
  ADD CONSTRAINT "requests_fromMaintenanceRequestId_fkey"
  FOREIGN KEY ("fromMaintenanceRequestId") REFERENCES "requests"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable maintenance for builtin partners
UPDATE "partner_establishments"
SET
  "maintenanceEnabled" = true,
  "maintenanceCloseDay" = CASE
    WHEN lower("name") LIKE '%golpas%' THEN 1
    ELSE 20
  END,
  "maintenanceUnitPrice" = CASE
    WHEN upper("name") = 'KFC' THEN 58500
    ELSE "maintenanceUnitPrice"
  END,
  "maintenanceCustomerName" = CASE
    WHEN upper("name") = 'KFC' THEN 'Товарищество с ограниченной ответственностью "Caspian International Restaurants Company (Каспиан Интернэшнл Рестронгз Компани)"'
    ELSE "maintenanceCustomerName"
  END,
  "maintenanceCustomerBin" = CASE
    WHEN upper("name") = 'KFC' THEN '070440007370'
    ELSE "maintenanceCustomerBin"
  END,
  "maintenanceCustomerAddress" = CASE
    WHEN upper("name") = 'KFC' THEN 'г.Алматы, ул.Абиш Кекилбайулы, дом 34, офис 2-01'
    ELSE "maintenanceCustomerAddress"
  END,
  "maintenanceContractNumber" = CASE
    WHEN upper("name") = 'KFC' THEN '2026-2204-S'
    ELSE "maintenanceContractNumber"
  END,
  "maintenanceContractDate" = CASE
    WHEN upper("name") = 'KFC' THEN TIMESTAMP '2026-04-22'
    ELSE "maintenanceContractDate"
  END,
  "maintenanceExecutorName" = COALESCE(
    "maintenanceExecutorName",
    'Индивидуальный Предприниматель «BerekeТехСервис»'
  ),
  "maintenanceExecutorBin" = COALESCE("maintenanceExecutorBin", '531010000098'),
  "maintenanceExecutorAddress" = COALESCE(
    "maintenanceExecutorAddress",
    'Республика Казахстан, г.Астана, ул. А105, д.20, офис 291'
  )
WHERE "isBuiltin" = true
  AND (
    upper("name") = 'KFC'
    OR "name" ILIKE '%hardee%'
    OR "name" ILIKE '%costa%'
    OR "name" ILIKE '%golpas%'
  );
