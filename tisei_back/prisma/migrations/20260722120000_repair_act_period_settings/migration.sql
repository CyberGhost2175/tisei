-- CreateTable
CREATE TABLE "repair_act_period_settings" (
    "id" TEXT NOT NULL,
    "partnerLocationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "actDate" TIMESTAMP(3),
    "actNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_act_period_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "repair_act_period_settings_period_idx" ON "repair_act_period_settings"("period");

-- CreateIndex
CREATE UNIQUE INDEX "repair_act_period_settings_partnerLocationId_period_key" ON "repair_act_period_settings"("partnerLocationId", "period");

-- AddForeignKey
ALTER TABLE "repair_act_period_settings" ADD CONSTRAINT "repair_act_period_settings_partnerLocationId_fkey" FOREIGN KEY ("partnerLocationId") REFERENCES "partner_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
