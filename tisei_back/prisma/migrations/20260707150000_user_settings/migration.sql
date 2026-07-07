-- CreateEnum
CREATE TYPE "ThemeMode" AS ENUM ('light', 'dark', 'system');

-- CreateTable
CREATE TABLE "user_settings" (
    "userId" TEXT NOT NULL,
    "theme" "ThemeMode" NOT NULL DEFAULT 'light',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
