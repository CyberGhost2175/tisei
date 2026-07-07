import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../src/common/utils/crypto.js';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword('Admin123!');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@tisei.kz' },
    update: {},
    create: {
      fullName: 'Администратор TiSei',
      email: 'admin@tisei.kz',
      phone: '+77001234567',
      passwordHash,
      role: UserRole.admin,
      isActive: true,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@tisei.kz' },
    update: {},
    create: {
      fullName: 'Менеджер TiSei',
      email: 'manager@tisei.kz',
      phone: '+77001234568',
      passwordHash,
      role: UserRole.manager,
      isActive: true,
    },
  });

  const executor = await prisma.user.upsert({
    where: { email: 'executor@tisei.kz' },
    update: {},
    create: {
      fullName: 'Мастер TiSei',
      email: 'executor@tisei.kz',
      phone: '+77001234569',
      passwordHash,
      role: UserRole.executor,
      specialization: ['Холодильное оборудование'],
      isActive: true,
    },
  });

  const categories = [
    'Холодильная камера',
    'Морозильная камера',
    'Кондиционер',
    'Парогенератор',
    'Ледогенератор',
    'Иное',
  ];

  for (const name of categories) {
    await prisma.equipmentCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const malfunctions = ['Не включается', 'Не морозит', 'Шум', 'Утечка', 'Иное'];
  for (const name of malfunctions) {
    await prisma.malfunctionType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const freezeReasons = ['Ожидание запчастей', 'Нет доступа к объекту', 'Клиент перенёс', 'Иное'];
  for (const name of freezeReasons) {
    await prisma.freezeReason.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const builtinPartners = [
    {
      name: "Hardee's",
      aliases: [
        'hardees',
        'hardys',
        'hardee',
        'харди',
        'хардис',
        "харди'с",
        'харди с',
        'хардиc',
      ],
    },
    {
      name: 'KFC',
      aliases: [
        'kfc',
        'кфс',
        'kentucky fried chicken',
        'кентукки',
        'кентаки',
        'кентаκι fried chicken',
      ],
    },
    {
      name: 'Costa Coffee',
      aliases: [
        'costa',
        'costa coffee',
        'costacoffee',
        'коста',
        'коста кофе',
        'костакофе',
        'коста coffee',
      ],
    },
    {
      name: 'Golpas',
      aliases: ['golpas', 'golpass', 'голпас', 'гол пас', 'gol pas'],
    },
  ];

  for (const partner of builtinPartners) {
    await prisma.partnerEstablishment.upsert({
      where: { name: partner.name },
      update: { aliases: partner.aliases, isBuiltin: true, isActive: true },
      create: { name: partner.name, aliases: partner.aliases, isBuiltin: true },
    });
  }

  await prisma.client.upsert({
    where: { id: 'seed-serviced-client' },
    update: {},
    create: {
      id: 'seed-serviced-client',
      name: 'Ресторан «Астана»',
      phone: '+77001112233',
      address: 'г. Алматы, ул. Абая 100',
      isServiced: true,
    },
  });

  console.info('Seed completed:', { admin: admin.email, manager: manager.email, executor: executor.email });
  console.info('Default password for all users: Admin123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
