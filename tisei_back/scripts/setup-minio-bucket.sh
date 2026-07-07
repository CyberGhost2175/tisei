#!/usr/bin/env bash
# Creates MinIO bucket for local attachment uploads.
# Requires: docker compose minio running (port 9000).
set -euo pipefail

BUCKET="${S3_BUCKET:-tisei-attachments}"

docker run --rm --network host minio/mc:latest sh -c "
  mc alias set local http://localhost:9000 minioadmin minioadmin &&
  mc mb --ignore-existing local/${BUCKET} &&
  mc anonymous set download local/${BUCKET}
"

echo "Bucket '${BUCKET}' is ready at http://localhost:9000/${BUCKET}"
