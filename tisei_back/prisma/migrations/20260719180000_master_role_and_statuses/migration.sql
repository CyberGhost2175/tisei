-- AlterEnum: UserRole
ALTER TYPE "UserRole" ADD VALUE 'master';

-- AlterEnum: RequestStatus
ALTER TYPE "RequestStatus" ADD VALUE 'awaiting_approval';
ALTER TYPE "RequestStatus" ADD VALUE 'repeat';

-- CreateEnum: AssignmentStatus
CREATE TYPE "AssignmentStatus" AS ENUM ('proposed', 'accepted');

-- AlterTable: request_assignments
ALTER TABLE "request_assignments" ADD COLUMN "status" "AssignmentStatus" NOT NULL DEFAULT 'accepted';
