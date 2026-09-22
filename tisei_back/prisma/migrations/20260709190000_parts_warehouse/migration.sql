-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_part_usages" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "partId" TEXT,
    "partNameSnapshot" TEXT NOT NULL,
    "unitPriceSnapshot" DECIMAL(14,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_part_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parts_name_idx" ON "parts"("name");

-- CreateIndex
CREATE INDEX "parts_isActive_idx" ON "parts"("isActive");

-- CreateIndex
CREATE INDEX "request_part_usages_requestId_idx" ON "request_part_usages"("requestId");

-- CreateIndex
CREATE INDEX "request_part_usages_partId_idx" ON "request_part_usages"("partId");

-- CreateIndex
CREATE INDEX "request_part_usages_createdAt_idx" ON "request_part_usages"("createdAt");

-- AddForeignKey
ALTER TABLE "request_part_usages" ADD CONSTRAINT "request_part_usages_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_part_usages" ADD CONSTRAINT "request_part_usages_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_part_usages" ADD CONSTRAINT "request_part_usages_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
