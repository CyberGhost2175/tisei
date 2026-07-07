# TiSei CRM Backend

Backend API for **TiSei** — a company repairing refrigeration, climate and heating equipment.

Serves two frontends: public landing (request form) and closed CRM (web + mobile executor app).

## Stack

- **Runtime:** Node.js 20+ (TypeScript strict)
- **Framework:** Fastify 5 + Zod validation + OpenAPI/Swagger
- **Database:** PostgreSQL + Prisma ORM
- **Queue:** BullMQ + Redis
- **Auth:** JWT (access + refresh cookie), Argon2, TOTP 2FA

## Quick start

### 1. Infrastructure

```bash
cd tisei_back
docker compose up -d
```

Starts PostgreSQL (5432), Redis (6379) and MinIO (9000/9001).

### 2. Environment

```bash
cp .env.example .env
# Edit secrets (JWT_* must be at least 16 chars)
```

### 3. Install & migrate

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
```

**Local PostgreSQL (pgAdmin) instead of Docker?**  
If port `5432` is already used by a local Postgres instance, `docker compose` Postgres will not start. Either:

1. **Use Docker Postgres** — stop local Postgres, then `docker compose up -d`.
2. **Use local Postgres** — create DB `tisei` in pgAdmin, then run `scripts/setup-local-postgres.sql` as user `developer` (grants user `tisei`).  
   Alternative: set `DATABASE_URL` to your local superuser, e.g. `postgresql://developer:YOUR_PASSWORD@localhost:5432/tisei?schema=public`.

### 4. Run API

```bash
npm run dev
```

- API: http://localhost:4000
- Health: http://localhost:4000/health
- **Swagger UI:** http://localhost:4000/docs

### 5. Background worker (optional)

```bash
npm run worker
```

Handles geocoding, overdue checks and deadline reminders.

## Default seed users

| Email | Role | Password |
|-------|------|----------|
| admin@tisei.kz | admin | Admin123! |
| manager@tisei.kz | manager | Admin123! |
| executor@tisei.kz | executor | Admin123! |

## API overview (`/api/v1`)

### Auth
- `POST /auth/login`, `/2fa/verify`, `/refresh`, `/logout`
- `POST /auth/password-reset/request`, `/password-reset/confirm`

### Public
- `POST /public/requests` — заявка с лендинга

### Requests
- CRUD, status, assign, freeze, duplicate, soft delete/restore, export-pdf
- `GET/POST /requests/:id/comments`
- `POST /requests/:id/attachments`
- `GET/POST/PATCH /requests/:id/closing-form`, `POST .../confirm`

### Users (admin)
- CRUD, `POST /users/:id/reset-password`, `POST /users/:id/archive`

### Clients (manager/admin)
- CRUD

### Notifications
- `GET /notifications`, `/unread-count`, `POST /mark-read`, `PATCH /:id/read`
- `GET/PATCH /notifications/preferences`

### Routing
- `GET /routing/today?executorId=`, `POST /routing/optimize`

### Analytics (manager/admin)
- `GET /analytics/dashboard`, `/reports/:type`, `/export`

### Dictionaries
- `GET/POST/PATCH/DELETE /dictionaries/{equipment-categories|malfunction-types|freeze-reasons}`

### Audit (admin)
- `GET /audit-log`

## Tests

```bash
npm test
```

Unit tests cover:
- Request status transition graph (`canTransition`)
- Closing form financial calculation (`calculateClosing`)

## Project structure

```
src/
  modules/
    auth/           — login, 2FA, refresh, password reset
    requests/       — CRUD, status transitions, public form
    closing-form/   — closing questionnaire + financials
    stubs/          — skeleton routes for remaining modules
  common/           — middleware, validation, utils
  jobs/             — BullMQ workers
  config/           — env, prisma, redis
prisma/
  schema.prisma
tests/
scripts/
  backup.sh         — pg_dump backup (30-day retention)
```

## Environment variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis for BullMQ |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT signing keys |
| `FRONTEND_CRM_URL` / `FRONTEND_LANDING_URL` | CORS origins |
| `S3_*` | Object storage for attachments (AWS S3 in production; MinIO optional for local dev) |

### Attachments (S3)

Production uses **AWS S3**. Set in `.env`:

- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` — IAM user with `s3:PutObject` on the bucket
- `S3_BUCKET` — bucket name (e.g. `tisei-attachments`)
- `S3_REGION` — e.g. `us-east-1`
- `S3_FORCE_PATH_STYLE=false` for AWS
- `S3_PUBLIC_URL` — public base URL where files are served, e.g. `https://your-bucket.s3.us-east-1.amazonaws.com` or your **CloudFront** domain

The bucket (or CloudFront) must allow **public read** for attachment URLs to open in the CRM, or use a CDN in front of the bucket.

For local dev without AWS, use MinIO from `docker compose` and the commented block in `.env.example`.
| `TWOGIS_API_KEY` | Geocoding provider |
| `RECAPTCHA_SECRET` | Public form protection |
| `WEB_PUSH_VAPID_*` | Web Push notifications |

## Database backup

```bash
export DATABASE_URL=postgresql://tisei:tisei@localhost:5432/tisei
chmod +x scripts/backup.sh
./scripts/backup.sh
```

## Production notes

- HTTPS is expected at the reverse proxy level
- Helmet security headers are enabled
- Rate limiting on `/auth/login` and `/public/requests`
- Soft-deleted requests can be restored within 30 days

## License

Proprietary — TiSei
