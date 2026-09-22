-- FCM device tokens for native mobile / web push
CREATE TABLE "device_push_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "device_push_tokens_token_key" ON "device_push_tokens"("token");

CREATE INDEX "device_push_tokens_userId_idx" ON "device_push_tokens"("userId");

CREATE INDEX "device_push_tokens_deviceId_idx" ON "device_push_tokens"("deviceId");

ALTER TABLE "device_push_tokens" ADD CONSTRAINT "device_push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
