# ── TiSei Backend — production multi-stage build ──────────────────────────────

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev \
  && npm install prisma@5.20.0 --omit=dev --no-save \
  && npx prisma generate

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat curl \
  && addgroup -g 1001 -S nodejs \
  && adduser -S tisei -u 1001 -G nodejs

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4000

COPY --from=prod-deps --chown=tisei:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=tisei:nodejs /app/prisma ./prisma
COPY --from=builder --chown=tisei:nodejs /app/dist ./dist
COPY --chown=tisei:nodejs package.json docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

USER tisei

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
