-- Priority is unset on new requests; manager sets P1–P4 manually.
ALTER TABLE "requests" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "requests" ALTER COLUMN "priority" DROP NOT NULL;
