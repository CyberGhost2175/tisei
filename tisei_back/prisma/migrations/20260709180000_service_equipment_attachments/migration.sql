-- CreateTable
CREATE TABLE "service_equipment_attachments" (
    "id" TEXT NOT NULL,
    "serviceEquipmentId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "fileType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_equipment_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_equipment_attachments_serviceEquipmentId_idx" ON "service_equipment_attachments"("serviceEquipmentId");

-- AddForeignKey
ALTER TABLE "service_equipment_attachments" ADD CONSTRAINT "service_equipment_attachments_serviceEquipmentId_fkey" FOREIGN KEY ("serviceEquipmentId") REFERENCES "service_equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_equipment_attachments" ADD CONSTRAINT "service_equipment_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
