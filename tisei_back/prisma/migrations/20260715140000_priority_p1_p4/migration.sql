-- Rename request priority levels: critical/high/normal/low → P1/P2/P3/P4
ALTER TYPE "RequestPriority" RENAME VALUE 'critical' TO 'P1';
ALTER TYPE "RequestPriority" RENAME VALUE 'high' TO 'P2';
ALTER TYPE "RequestPriority" RENAME VALUE 'normal' TO 'P3';
ALTER TYPE "RequestPriority" RENAME VALUE 'low' TO 'P4';
