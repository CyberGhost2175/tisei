# TiSei — Production Deployment (Docker)

Есть два сценария:

- **Без домена, только визитка + API** (ваш текущий VPS) — см. [docs/HOSTING.md](docs/HOSTING.md) и `docker-compose.hosting.yml`.
- **С доменами, SSL и CRM-фронтом** — этот файл и `docker-compose.prod.yml`.

---

Развёртывание на **Ubuntu 24.04 VPS** с **Docker Compose**, **Nginx Proxy Manager** (SSL / Let's Encrypt) и **AWS S3**.

## Архитектура

```
Internet → Nginx Proxy Manager (SSL) → Docker network `tisei_prod`
                                         ├── crm:3000
                                         ├── landing:3001
                                         ├── backend:4000
                                         └── postgres:5432 (internal)

Host Redis (BullMQ) ← backend via host.docker.internal:6379
```

Контейнеры **не публикуют порты** наружу (`expose` only). Доступ только через reverse proxy.

---

## Требования к серверу

- Ubuntu 24.04 LTS
- Docker Engine 24+ и Docker Compose v2
- 2+ GB RAM (рекомендуется 4 GB)
- Домены, указывающие на VPS:
  - `crm.example.com` → CRM
  - `example.com` → Landing
  - `api.example.com` → Backend API

---

## Быстрый старт

### 1. Установка Docker (Ubuntu 24.04)

```bash
sudo apt update && sudo apt install -y ca-certificates curl
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# перелогиньтесь
```

### 2. Клонирование проекта

```bash
git clone <your-repo-url> tisei
cd tisei
```

### 3. Redis на хосте (обязательно для очередей BullMQ)

```bash
sudo apt install -y redis-server
sudo systemctl enable --now redis-server
redis-cli ping   # должно вернуть PONG
```

В `.env` оставьте `REDIS_URL=redis://host.docker.internal:6379` (уже в `.env.example`).

### 4. Переменные окружения

```bash
cp .env.example .env
nano .env
```

**Обязательно замените:**

| Переменная | Описание |
|---|---|
| `POSTGRES_PASSWORD` | Надёжный пароль БД (без спецсимволов `@ : /` в URL) |
| `JWT_ACCESS_SECRET` | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 48` |
| `API_BASE_URL` | Публичный URL API, напр. `https://api.tisei.kz` |
| `FRONTEND_CRM_URL` | `https://crm.tisei.kz` |
| `FRONTEND_LANDING_URL` | `https://tisei.kz` |
| `NEXT_PUBLIC_API_URL` | `https://api.tisei.kz/api/v1` |
| `S3_*` | Ключи и bucket AWS S3 |

### 5. Запуск

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Проверка:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

При старте backend автоматически:
- применяет миграции Prisma (`prisma migrate deploy`);
- запускает фоновый worker (очереди BullMQ);
- поднимает API на порту `4000`.

### 6. Первичное наполнение БД (опционально)

С production-контейнера seed недоступен (нет `tsx`). Запустите с машины разработки, указав URL production БД:

```bash
cd tisei_back
DATABASE_URL="postgresql://USER:PASS@VPS_IP:5432/tisei?schema=public" npm run db:seed
```

Или создайте первого администратора вручную через SQL/API.

---

## Nginx Proxy Manager

1. Установите NPM (отдельный compose или на том же хосте).
2. Подключите NPM к сети `tisei_prod`:

```bash
docker network connect tisei_prod <npm-container-name>
```

3. Создайте Proxy Hosts (SSL → Request new SSL Certificate):

| Домен | Forward Hostname | Port | Websockets |
|---|---|---|---|
| `crm.tisei.kz` | `tisei-crm` | `3000` | Off |
| `tisei.kz` | `tisei-landing` | `3001` | Off |
| `api.tisei.kz` | `tisei-backend` | `4000` | Off |

4. Включите: **Block Common Exploits**, **HTTP/2**, **Force SSL**, **HSTS** (по желанию).

> SSL терминируется в NPM. Внутри Docker TLS **не** используется.

---

## Переменные окружения

Полный список — в [`.env.example`](.env.example) в корне репозитория.

### Backend

- `DATABASE_URL` — переопределяется в compose на `postgres:5432`
- `REDIS_URL` — Redis на хосте (`redis://host.docker.internal:6379`)
- `FRONTEND_CRM_URL` / `FRONTEND_LANDING_URL` — CORS
- `S3_*` — AWS S3 для вложений

### CRM / Landing (build-time)

Оба фронтенда собираются с `output: "standalone"` — в образ попадает только `.next/standalone` + static + public, запуск через `node server.js` (меньший образ, быстрее старт).

- `NEXT_PUBLIC_API_URL` — вшивается при `docker build`
- `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` — карта в CRM (опционально)

### Landing (runtime)

- `BACKEND_INTERNAL_URL=http://backend:4000/api/v1` — серверный маршрут формы заявки внутри Docker

---

## Обновление проекта

```bash
cd /path/to/tisei
git pull

# Пересборка и перезапуск (миграции применятся автоматически)
docker compose -f docker-compose.prod.yml up -d --build

# Проверка
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=50 backend
```

Если менялись `NEXT_PUBLIC_*` — нужна пересборка фронтов (`--build`).

---

## Резервное копирование PostgreSQL

### Создать бэкап

```bash
mkdir -p ~/tisei-backups
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner --no-acl \
  | gzip > ~/tisei-backups/tisei_$(date +%Y%m%d_%H%M%S).sql.gz
```

Или с хоста (подставьте пароль из `.env`):

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U tisei -d tisei | gzip > backup.sql.gz
```

### Автоматизация (cron)

```cron
0 3 * * * cd /opt/tisei && docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U tisei -d tisei | gzip > /opt/backups/tisei_$(date +\%Y\%m\%d).sql.gz
```

### Восстановление из бэкапа

```bash
# Остановить backend (чтобы не писал в БД)
docker compose -f docker-compose.prod.yml stop backend

# Восстановить
gunzip -c ~/tisei-backups/backup.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U tisei -d tisei

# Запустить снова
docker compose -f docker-compose.prod.yml start backend
```

Полная пересоздание БД (осторожно — удалит данные):

```bash
docker compose -f docker-compose.prod.yml stop backend
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U tisei -c "DROP DATABASE tisei; CREATE DATABASE tisei;"
gunzip -c backup.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U tisei -d tisei
docker compose -f docker-compose.prod.yml start backend
```

---

## Healthcheck

| Сервис | Проверка |
|---|---|
| postgres | `pg_isready` |
| backend | `GET /health` (start_period 60s — миграции Prisma) |
| crm | `GET /login` |
| landing | `GET /` |

```bash
docker inspect --format='{{.State.Health.Status}}' tisei-backend
```

---

## Полезные команды

```bash
# Логи
docker compose -f docker-compose.prod.yml logs -f

# Перезапуск одного сервиса
docker compose -f docker-compose.prod.yml restart backend

# Остановка
docker compose -f docker-compose.prod.yml down

# Остановка с удалением volumes (УДАЛИТ БД!)
docker compose -f docker-compose.prod.yml down -v
```

---

## Безопасность

- Не коммитьте `.env` в git.
- Используйте сильные пароли и JWT-секреты.
- Порты приложений не проброшены на хост — только NPM.
- Redis и PostgreSQL не доступны из интернета (PostgreSQL — только внутри Docker; Redis — только localhost на VPS).
- Обновляйте образы: `docker compose pull` для `postgres` / `redis`.

---

## Устранение неполадок

**Backend не стартует — ошибка env**  
Проверьте `.env`: все обязательные поля из `.env.example`.

**CORS ошибки в браузере**  
`FRONTEND_CRM_URL` и `FRONTEND_LANDING_URL` должны точно совпадать с URL в браузере (с `https://`).

**Форма на лендинге не отправляется**  
Проверьте `BACKEND_INTERNAL_URL` и логи: `docker compose logs landing backend`.

**Миграции**  
```bash
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

**Пересборка без кэша**  
```bash
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```
