-- CreateEnum
CREATE TYPE "PartSection" AS ENUM ('SERVICE', 'KFC');

-- AlterTable
ALTER TABLE "parts" ADD COLUMN "section" "PartSection" NOT NULL DEFAULT 'SERVICE';

-- CreateIndex
CREATE INDEX "parts_section_idx" ON "parts"("section");

-- CreateIndex
CREATE UNIQUE INDEX "parts_section_name_key" ON "parts"("section", "name");
