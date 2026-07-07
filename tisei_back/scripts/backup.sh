#!/usr/bin/env bash
# TiSei CRM — daily PostgreSQL backup script (DevOps starter)
# Retains backups for 30 days. Configure via environment variables.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="tisei_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

echo "Creating backup: ${BACKUP_DIR}/${FILENAME}"
pg_dump "$DATABASE_URL" | gzip > "${BACKUP_DIR}/${FILENAME}"

echo "Removing backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name 'tisei_*.sql.gz' -mtime +"${RETENTION_DAYS}" -delete

echo "Done."
