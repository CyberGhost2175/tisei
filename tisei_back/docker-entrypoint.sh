#!/bin/sh
set -e

WORKER_PID=""
SERVER_PID=""

shutdown() {
  if [ -n "$SERVER_PID" ]; then
    kill -TERM "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  if [ -n "$WORKER_PID" ]; then
    kill -TERM "$WORKER_PID" 2>/dev/null || true
    wait "$WORKER_PID" 2>/dev/null || true
  fi
}

trap shutdown TERM INT

echo "[entrypoint] Applying database migrations..."
npx prisma migrate deploy

echo "[entrypoint] Starting background worker..."
node dist/jobs/worker.js &
WORKER_PID=$!

echo "[entrypoint] Starting API server..."
node dist/server.js &
SERVER_PID=$!

set +e
wait "$SERVER_PID"
EXIT_CODE=$?
shutdown
exit "$EXIT_CODE"
