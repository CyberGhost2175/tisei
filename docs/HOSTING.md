# Заливка на VPS без домена (визитка + API)

Домен **не обязателен**. Сайт и API открываются по IP, Telegram-бот ходит на API с того же сервера (polling, HTTPS для бота не нужен).

Let’s Encrypt без домена получить нельзя — будет обычный HTTP. Для визитки, формы заявки и бота этого достаточно. Когда появится домен — повесите Nginx/SSL поверх, код менять почти не придётся.

На этом сервере **нет CRM-фронта** (экономия RAM). Управление заявками — Telegram-бот + API.

```
Интернет
  http://IP/          → визитка (landing)
  http://IP:4000      → API  (/health, /docs, /api/v1)
  Telegram            → бот сам стучится в api.telegram.org, потом в API на localhost
```

Сервер из панели: **2 CPU / 2 GB RAM / 40 GB**, Ubuntu 24.04, IP `87.199.130.251`.

---

## 1. На сервере один раз

SSH под root/ubuntu:

```bash
sudo apt update && sudo apt install -y ca-certificates curl git ufw
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Swap 2 ГБ (на 2 ГБ RAM обязательно):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Порты (SSH не закрывать):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 4000/tcp
sudo ufw enable
```

Перелогиньтесь, чтобы заработала группа `docker`.

---

## 2. Код и .env

```bash
cd /opt
sudo git clone <url-репозитория> tisei
sudo chown -R $USER:$USER /opt/tisei
cd /opt/tisei
cp .env.hosting.example .env
nano .env
```

Обязательно замените:

| Поле | Что поставить |
|------|----------------|
| `PUBLIC_HOST` / все URL | ваш IP, сейчас `87.199.130.251` |
| `POSTGRES_PASSWORD` | буквы и цифры, **без** `@ : /` |
| `JWT_ACCESS_SECRET` | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 48` |
| `BOOTSTRAP_ADMIN_PASSWORD` | пароль админа, минимум 8 символов |
| `COOKIE_SECURE` | `false` (HTTP по IP) |

`FRONTEND_LANDING_URL` должен быть **точно** как в браузере: `http://87.199.130.251` без слэша и без `:80`.

---

## 3. Запуск

```bash
cd /opt/tisei
docker compose -f docker-compose.hosting.yml up -d --build
docker compose -f docker-compose.hosting.yml ps
docker compose -f docker-compose.hosting.yml logs -f backend
```

Проверка с вашего компьютера:

- визитка: http://87.199.130.251/
- API: http://87.199.130.251:4000/health  → `{"status":"ok"}` (или похожее)
- Swagger: http://87.199.130.251:4000/docs

Первый админ (если задали `BOOTSTRAP_ADMIN_PASSWORD`):

- email: `admin@tisei.kz`
- пароль: из `.env`
- плюс менеджер `manager@tisei.kz` с тем же паролем — им входить в Telegram-бота

---

## 4. Telegram-бот на этом же VPS

Бот отдельным процессом, API уже слушает `4000` на хосте:

```bash
cd /opt/tisei-bot   # или куда скопируете проект
cp .env.example .env
nano .env
```

```
BOT_TOKEN=...из BotFather
API_BASE_URL=http://127.0.0.1:4000/api/v1
DATA_DIR=./data
```

```bash
npm install
npm run build
sudo cp /opt/tisei-bot/tisei-bot.service /etc/systemd/system/   # или unit из README бота
```

Либо вручную unit:

```ini
[Unit]
Description=TiSei Telegram bot
After=docker.service
Requires=docker.service

[Service]
WorkingDirectory=/opt/tisei-bot
EnvironmentFile=/opt/tisei-bot/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now tisei-bot
```

Бот **не требует домена и HTTPS**: он сам опрашивает Telegram.

---

## 5. Что не открыто в интернет

- Postgres и Redis — только внутри Docker
- CRM-фронт — не собирается
- Порт 5432 на хост не проброшен

---

## Обновление

```bash
cd /opt/tisei
git pull
docker compose -f docker-compose.hosting.yml up -d --build
```

Если меняли `NEXT_PUBLIC_API_URL` — нужна пересборка визитки (`--build`).

---

## Когда появится домен

1. A-запись на этот IP.
2. Nginx / NPM: `site.kz` → `tisei-landing:3001`, `api.site.kz` → `tisei-backend:4000`, SSL Let’s Encrypt.
3. В `.env`: `https://...`, `COOKIE_SECURE=true`.
4. Убрать проброс `:80` и `:4000` с хоста, оставить `expose` как в `docker-compose.prod.yml`.

Пока домена нет — этот compose специально публикует порты на IP.
