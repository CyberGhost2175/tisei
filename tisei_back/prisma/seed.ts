import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../src/common/utils/crypto.js';
import { KFC_PARTS_PRICE_LIST } from './seed-kfc-parts.js';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword('Admin123!');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@tisei.kz' },
    update: {},
    create: {
      fullName: 'Администратор Береке',
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
      fullName: 'Менеджер Береке',
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
      fullName: 'Мастер Береке',
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

  const caspianCustomer = {
    maintenanceCustomerName:
      'Товарищество с ограниченной ответственностью " Caspian International Restaurants Company (Каспиан Интернэшнл Рестронгз Компани)"',
    maintenanceCustomerBin: '070440007370',
    maintenanceCustomerAddress: 'г.Алматы, ул.Абиш Кекилбайулы, дом 34, офис 2-01',
    maintenanceContractNumber: '2026-2204-S',
    maintenanceContractDate: new Date('2026-04-22'),
    maintenanceExecutorName: 'Индивидуальный Предприниматель «BerekeТехСервис»',
    maintenanceExecutorBin: '531010000098',
    maintenanceExecutorAddress:
      'Республика Казахстан, г.Астана, ул. А105, д.20, офис 291',
  } as const;

  for (const partner of builtinPartners) {
    const isGolpas = partner.name.toLowerCase().includes('golpas');
    const isCosta = partner.name === 'Costa Coffee';
    const isCaspian =
      partner.name.toUpperCase() === 'KFC' ||
      partner.name === "Hardee's" ||
      isCosta;
    // Цены с НДС по актам Caspian: Hardee's/KFC 58 500, Costa 13 440
    const caspianUnitPrice = isCosta ? 13440 : 58500;
    await prisma.partnerEstablishment.upsert({
      where: { name: partner.name },
      update: {
        aliases: partner.aliases,
        isBuiltin: true,
        isActive: true,
        maintenanceEnabled: true,
        maintenanceCloseDay: isGolpas ? 1 : 20,
        maintenancePriceIncludesVat: !isGolpas,
        ...(isCaspian
          ? {
              maintenanceUnitPrice: caspianUnitPrice,
              ...caspianCustomer,
            }
          : isGolpas
            ? {
                maintenanceUnitPrice: 600000,
                maintenanceCustomerName:
                  'Товарищество с ограниченной ответственностью «Астана Фаворит»',
                maintenanceCustomerBin: '230540005134',
                maintenanceCustomerAddress:
                  'Республика Казахстан, г. Астана, ул. Сыганак, 54А, НП 13',
                maintenanceContractNumber: 'GP2026',
                maintenanceContractDate: new Date('2026-01-29'),
                maintenanceExecutorName:
                  'Индивидуальный Предприниматель «Береке ТехСервис»',
                maintenanceExecutorBin: '040617551693',
                maintenanceExecutorAddress:
                  'Республика Казахстан, г.Астана, ул.К.Аманжолова, д.28/1',
              }
            : {
              maintenanceExecutorName: 'Индивидуальный Предприниматель «BerekeТехСервис»',
              maintenanceExecutorBin: '531010000098',
              maintenanceExecutorAddress:
                'Республика Казахстан, г.Астана, ул. А105, д.20, офис 291',
            }),
      },
      create: {
        name: partner.name,
        aliases: partner.aliases,
        isBuiltin: true,
        maintenanceEnabled: true,
        maintenanceCloseDay: isGolpas ? 1 : 20,
        maintenancePriceIncludesVat: !isGolpas,
        ...(isCaspian
          ? {
              maintenanceUnitPrice: caspianUnitPrice,
              ...caspianCustomer,
            }
          : isGolpas
            ? {
                maintenanceUnitPrice: 600000,
                maintenanceCustomerName:
                  'Товарищество с ограниченной ответственностью «Астана Фаворит»',
                maintenanceCustomerBin: '230540005134',
                maintenanceCustomerAddress:
                  'Республика Казахстан, г. Астана, ул. Сыганак, 54А, НП 13',
                maintenanceContractNumber: 'GP2026',
                maintenanceContractDate: new Date('2026-01-29'),
                maintenanceExecutorName:
                  'Индивидуальный Предприниматель «Береке ТехСервис»',
                maintenanceExecutorBin: '040617551693',
                maintenanceExecutorAddress:
                  'Республика Казахстан, г.Астана, ул.К.Аманжолова, д.28/1',
              }
            : {
                maintenanceExecutorName: 'Индивидуальный Предприниматель «BerekeТехСервис»',
                maintenanceExecutorBin: '531010000098',
                maintenanceExecutorAddress:
                  'Республика Казахстан, г.Астана, ул. А105, д.20, офис 291',
              }),
      },
    });
  }

  const partnerLocationsByBrand: Record<
    string,
    Array<{
      name: string;
      address: string;
      equipmentQuantity?: number;
      maintenancePrice?: number;
    }>
  > = {
    KFC: [
      { name: 'Khan Shatyr', address: 'пр. Туран, 37 ТРЦ Хан Шатыр' },
      { name: 'Mega EXPO', address: 'пр. Кабанбай батыра, 62' },
      { name: 'Kosshy', address: 'ул. Косшы 016' },
      { name: 'Syganak Mechta', address: 'ул. Сыганак 3' },
      { name: 'Saryarka', address: 'пр. Туран, ТРЦ Сары Арка, 24' },
      { name: 'Ncity', address: 'пр. Туран 53 В, ТЦ N city' },
      { name: 'Keruen', address: 'ул. Достык 9' },
      { name: 'Asia Park', address: 'пр. Кабанбай батыра 21' },
      { name: 'Nomad Relocation', address: 'ул. Ханов Керея и Жанибека' },
      { name: 'Mega Astana (Keruen City)', address: 'ул. Коргалжын 1' },
      { name: 'Astrakhanka', address: 'ул. Алаш серы 71/1' },
      { name: 'Bogenbay', address: 'пр. Богенбай батыра 19' },
      { name: 'Golden Key', address: 'пр. Победы 67' },
      { name: 'Manasa', address: 'ул. Тауелсиздик, 18' },
      { name: 'Respublika', address: 'пр. Республики 7' },
      { name: 'Vstrecha', address: 'ул. Абылай хана, 38' },
      { name: 'Magnum Edil', address: 'ул. Едиль, 27' },
      { name: 'Nurly zhol', address: 'ЖД вокзал Нурлы Жол' },
      { name: 'Oasis', address: 'ул. 179, корпус №24' },
      { name: 'Green', address: 'ул. Уалиханова, 20' },
      { name: 'Mechta', address: 'ул. Амман 14' },
      { name: 'Zhybek zholy Compass', address: 'с. Жибек жолы, 1-ый микрорайон' },
      { name: 'Food city', address: 'ул. Бейбарыс Султан 3' },
    ],
    "Hardee's": [
      { name: 'Asia Park', address: 'пр. Кабанбай батыра 21' },
      { name: 'Khan Shatyr', address: 'пр. Туран, 37 ТРК Хан Шатыр' },
      { name: 'Mega EXPO', address: 'пр. Кабанбай батыра, 62' },
      { name: 'Sauran', address: 'ул. Гейдара Алиева 8' },
      { name: 'Ncity', address: 'пр. Туран 53 В, ТЦ N city' },
      { name: 'Seifullina', address: 'пр. Республики 34/1' },
      { name: 'Keruen', address: 'ул. Достык 9' },
      { name: 'Mega Astana (Keruen City)', address: 'ул. Коргалжын 1' },
      { name: 'Agip', address: 'пр. Кабанбай батыра 6' },
      { name: 'Manasa', address: 'ул. Тауелсиздик 21/1' },
      { name: 'Respublika', address: 'пр. Республики 7' },
      { name: 'Food city', address: 'ул. Бейбарыс Султан 3' },
    ],
    'Costa Coffee': [
      { name: 'YES Apart', address: 'ул. Туран 16' },
      { name: 'Keruen', address: 'ул. Достык 9' },
      { name: 'Asia Park', address: 'пр. Кабанбай батыра 21' },
      { name: 'Mega Astana (Keruen City)', address: 'ул. Коргалжын 1' },
      { name: 'Respublika', address: 'пр. Республики 7' },
    ],
    // КП Golpas — цены без НДС, кол-во оборудования на точке
    Golpas: [
      {
        name: 'Аманжолова 26',
        address: 'р-н Сарайшык, ул. Касыма Аманжолова, 26',
        equipmentQuantity: 15,
        maintenancePrice: 60000,
      },
      {
        name: 'Калдаяков 2а',
        address: 'р-н Сарайшык, ул. Шамши Калдаяков, 2а',
        equipmentQuantity: 17,
        maintenancePrice: 60000,
      },
      {
        name: 'Конаев 35',
        address: 'р-н Есиль, ул. Динмухамед Конаев, 35',
        equipmentQuantity: 14,
        maintenancePrice: 50000,
      },
      {
        name: 'Бокейхан 6',
        address: 'р-н Есиль, ул. Алихан Бокейхан, 6',
        equipmentQuantity: 14,
        maintenancePrice: 50000,
      },
      {
        name: 'Мангилик Ел 35',
        address: 'р-н Есиль, ЖК Триумфальная Арка, пр. Мангилик Ел, 35',
        equipmentQuantity: 11,
        maintenancePrice: 40000,
      },
      {
        name: 'Бокейхан 38',
        address: 'р-н Есиль, ул. Алихан Бокейхан, 38',
        equipmentQuantity: 15,
        maintenancePrice: 60000,
      },
      {
        name: 'Кабанбай 48/5',
        address: 'р-н Есиль, пр-т Кабанбай батыр, 48/5',
        equipmentQuantity: 13,
        maintenancePrice: 45000,
      },
      {
        name: 'Улы Дала 54',
        address: 'р-н Есиль, пр. Улы Дала, 54',
        equipmentQuantity: 15,
        maintenancePrice: 60000,
      },
      {
        name: 'Кенесары 65',
        address: 'р-н Байконыр, ул. Кенесары, 65',
        equipmentQuantity: 13,
        maintenancePrice: 45000,
      },
      {
        name: 'Кабанбай 7',
        address: 'р-н Нура, пр. Кабанбай батыр, 7',
        equipmentQuantity: 16,
        maintenancePrice: 60000,
      },
      {
        name: 'Сыганак 54а',
        address: 'р-н Нура, ул. Сыганак, 54а',
        equipmentQuantity: 12,
        maintenancePrice: 40000,
      },
      {
        name: 'Момышулы 2в',
        address: 'р-н Алматы, пр-т Бауыржан Момышулы, 2в',
        equipmentQuantity: 16,
        maintenancePrice: 60000,
      },
      {
        name: 'Туран 19/1',
        address: 'пр-т Туран, 19/1',
        equipmentQuantity: 14,
        maintenancePrice: 50000,
      },
      {
        name: 'Туран 60',
        address: 'пр-т Туран, 60',
        equipmentQuantity: 14,
        maintenancePrice: 50000,
      },
    ],
  };

  for (const [brandName, locations] of Object.entries(partnerLocationsByBrand)) {
    const partner = await prisma.partnerEstablishment.findUnique({ where: { name: brandName } });
    if (!partner) continue;
    for (const loc of locations) {
      await prisma.partnerLocation.upsert({
        where: {
          partnerEstablishmentId_name: {
            partnerEstablishmentId: partner.id,
            name: loc.name,
          },
        },
        update: {
          city: 'Астана',
          address: loc.address,
          isActive: true,
          ...(loc.equipmentQuantity !== undefined
            ? { equipmentQuantity: loc.equipmentQuantity }
            : {}),
          ...(loc.maintenancePrice !== undefined
            ? { maintenancePrice: loc.maintenancePrice }
            : {}),
        },
        create: {
          partnerEstablishmentId: partner.id,
          name: loc.name,
          city: 'Астана',
          address: loc.address,
          equipmentQuantity: loc.equipmentQuantity ?? null,
          maintenancePrice: loc.maintenancePrice ?? null,
        },
      });
    }
  }

  // Golpas: акт как у ТОО «Астана Фаворит» — 600 000 без НДС, договор GP2026
  await prisma.partnerEstablishment.updateMany({
    where: { name: 'Golpas' },
    data: {
      maintenanceEnabled: true,
      maintenanceCloseDay: 1,
      maintenancePriceIncludesVat: false,
      maintenanceUnitPrice: 600000,
      maintenanceCustomerName:
        'Товарищество с ограниченной ответственностью «Астана Фаворит»',
      maintenanceCustomerBin: '230540005134',
      maintenanceCustomerAddress:
        'Республика Казахстан, г. Астана, ул. Сыганак, 54А, НП 13',
      maintenanceContractNumber: 'GP2026',
      maintenanceContractDate: new Date('2026-01-29'),
      maintenanceExecutorName: 'Индивидуальный Предприниматель «Береке ТехСервис»',
      maintenanceExecutorBin: '040617551693',
      maintenanceExecutorAddress:
        'Республика Казахстан, г.Астана, ул.К.Аманжолова, д.28/1',
    },
  });

  // Caspian (KFC / Hardee's / Costa): акт по точкам, цена с НДС, договор 2026-2204-S
  for (const [name, unitPrice] of [
    ['KFC', 58500],
    ["Hardee's", 58500],
    ['Costa Coffee', 13440],
  ] as const) {
    await prisma.partnerEstablishment.updateMany({
      where: { name },
      data: {
        maintenanceEnabled: true,
        maintenanceCloseDay: 20,
        maintenancePriceIncludesVat: true,
        maintenanceUnitPrice: unitPrice,
        ...caspianCustomer,
      },
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

  for (const part of KFC_PARTS_PRICE_LIST) {
    await prisma.part.upsert({
      where: {
        section_name: {
          section: 'KFC',
          name: part.name,
        },
      },
      update: { unitPrice: part.unitPrice, isActive: true },
      create: {
        section: 'KFC',
        name: part.name,
        unitPrice: part.unitPrice,
        quantity: 0,
      },
    });
  }

  console.info('Seed completed:', {
    admin: admin.email,
    manager: manager.email,
    executor: executor.email,
    kfcParts: KFC_PARTS_PRICE_LIST.length,
  });
  console.info('Default password for all users: Admin123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
