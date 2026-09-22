import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@tisei.kz').trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '';
const fullName = process.env.BOOTSTRAP_ADMIN_NAME ?? 'Администратор';

if (password.length < 8) {
  console.info('[bootstrap] BOOTSTRAP_ADMIN_PASSWORD не задан или короче 8 символов — пропуск');
  process.exit(0);
}

const prisma = new PrismaClient();

try {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.info(`[bootstrap] Пользователь ${email} уже есть — пароль не трогаю`);
  } else {
    await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: 'admin',
        isActive: true,
      },
    });
    console.info(`[bootstrap] Создан администратор ${email}`);
  }

  const managerEmail = 'manager@tisei.kz';
  const managerExists = await prisma.user.findUnique({ where: { email: managerEmail } });
  if (!managerExists) {
    await prisma.user.create({
      data: {
        fullName: 'Менеджер',
        email: managerEmail,
        passwordHash,
        role: 'manager',
        isActive: true,
      },
    });
    console.info(`[bootstrap] Создан менеджер ${managerEmail} (тот же пароль)`);
  }
} catch (err) {
  console.error('[bootstrap] Ошибка:', err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
