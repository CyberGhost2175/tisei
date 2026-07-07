-- Run in pgAdmin Query Tool while connected as `developer` (or another superuser).
-- Fixes: P1010 User `tisei` was denied access on the database `tisei`

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'tisei') THEN
    CREATE ROLE tisei LOGIN PASSWORD 'tisei';
  ELSE
    ALTER ROLE tisei WITH LOGIN PASSWORD 'tisei';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE tisei TO tisei;
GRANT ALL PRIVILEGES ON DATABASE tisei TO tisei;

-- In pgAdmin: connect to database `tisei`, then run the block below.
-- (Or run everything after \c tisei if using psql.)

GRANT USAGE, CREATE ON SCHEMA public TO tisei;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO tisei;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO tisei;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO tisei;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO tisei;
