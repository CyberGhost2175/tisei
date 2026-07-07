# AWS S3 — настройка для TiSei (без CloudFront)

Бакет: `tisei-attachments`  
Регион: `us-east-1`  
IAM user: `tisei-s3-user`

## 1. Access Key → `.env`

В `tisei_back/.env` (у вас уже почти всё есть):

```env
S3_REGION=us-east-1
S3_BUCKET=tisei-attachments
S3_ACCESS_KEY_ID=your-aws-access-key-id
S3_SECRET_ACCESS_KEY=<секрет, который показали ОДИН раз при создании ключа>
S3_ENDPOINT=
S3_FORCE_PATH_STYLE=false
S3_PUBLIC_URL=https://tisei-attachments.s3.us-east-1.amazonaws.com
```

Если ключ создавали сегодня заново — **старый Secret Access Key не подойдёт**.  
Нужен именно тот Secret Access Key, который скачали при создании ключа.

## 2. IAM — права пользователю

IAM → Users → `tisei-s3-user` → **Add permissions** → Create inline policy → JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TiseiAttachments",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::tisei-attachments",
        "arn:aws:s3:::tisei-attachments/*"
      ]
    }
  ]
}
```

Если уже повесили `AdministratorAccess` — этого достаточно, шаг можно пропустить.

## 3. Публичное чтение файлов (для превью в CRM)

CRM показывает картинки по прямой ссылке `<img src="https://...s3.../requests/...">`.  
Файлы должны быть **доступны на чтение без авторизации**.

### 3.1 Block Public Access

S3 → `tisei-attachments` → **Permissions** → **Block public access** → Edit:

- Снимите галочку **«Block public access to buckets and objects granted through new public bucket or access point policies»**
- Сохраните, подтвердите `confirm`

(Остальные три галочки можно оставить включёнными.)

### 3.2 Bucket policy

Тот же раздел **Permissions** → **Bucket policy** → Edit:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadAttachments",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::tisei-attachments/requests/*"
    }
  ]
}
```

Только папка `requests/` будет публичной на чтение. Загрузка по-прежнему только через API с вашими ключами.

## 4. Запуск

```bash
cd tisei_back
npm run dev
```

CRM: откройте заявку → **Вложения** → загрузите JPG/PNG.

## 5. Проверка

1. В S3 → `tisei-attachments` → Objects — должен появиться файл `requests/xxxx.jpg`
2. Откройте ссылку из CRM в новой вкладке — картинка должна открыться
3. Если загрузка падает — смотрите ответ в DevTools → Network → `POST .../attachments`

### Частые ошибки

| Симптом | Причина |
|--------|---------|
| `AccessDenied` при загрузке | Неверный Secret Key или нет IAM policy |
| Загрузилось, но картинка не видна | Нет bucket policy / Block Public Access |
| `Тип файла не поддерживается` | HEIC с iPhone — конвертируйте в JPG или используйте PNG |

## 6. Продакшен

На сервере те же переменные `S3_*` в `.env`.  
CloudFront не обязателен; при желании позже замените `S3_PUBLIC_URL` на домен CDN.
