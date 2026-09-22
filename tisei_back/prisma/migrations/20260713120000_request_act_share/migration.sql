-- AlterTable
ALTER TABLE "requests" ADD COLUMN "actShareTokenHash" TEXT;
ALTER TABLE "requests" ADD COLUMN "actShareCreatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "requests_actShareTokenHash_key" ON "requests"("actShareTokenHash");
