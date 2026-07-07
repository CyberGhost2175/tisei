import { Worker } from 'bullmq';
import { getBullMqConnection } from '../config/redis.js';
import { prisma } from '../config/prisma.js';
import { QUEUE_NAMES } from './queues.js';
import { geocodeAddress } from '../common/geocode/geocode-address.js';

const connection = getBullMqConnection();

/** Geocode request address (Yandex → 2GIS → OSM). */
async function handleGeocode(data: { requestId: string; address: string }): Promise<void> {
  const coords = await geocodeAddress(data.address);
  if (coords) {
    await prisma.request.update({
      where: { id: data.requestId },
      data: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        geocodedAt: new Date(),
      },
    });
    return;
  }

  console.warn('[worker:geocode] could not geocode:', data.address);
}

/** Mark overdue requests and enqueue notifications. */
async function handleOverdueCheck(): Promise<void> {
  const now = new Date();
  const overdue = await prisma.request.findMany({
    where: {
      deletedAt: null,
      deadline: { lt: now },
      status: { notIn: ['closed', 'cancelled'] },
    },
    select: { id: true, number: true },
  });

  for (const req of overdue) {
    console.info('[worker:overdue] request overdue:', req.number);
    // TODO: enqueue notification
  }
}

/** Send 24h deadline reminders (idempotent per request+deadline). */
async function handleDeadlineReminders(): Promise<void> {
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const windowStart = new Date(in24h.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(in24h.getTime() + 30 * 60 * 1000);

  const upcoming = await prisma.request.findMany({
    where: {
      deletedAt: null,
      deadline: { gte: windowStart, lte: windowEnd },
      status: { notIn: ['closed', 'cancelled'] },
    },
    include: { assignments: true },
  });

  for (const req of upcoming) {
    console.info('[worker:reminder] 24h reminder for:', req.number);
    // TODO: idempotent notification via Redis key
  }
}

const geocodeWorker = new Worker(
  QUEUE_NAMES.geocode,
  async (job) => handleGeocode(job.data as { requestId: string; address: string }),
  { connection },
);

geocodeWorker.on('failed', (job, err) => {
  console.error('[worker:geocode] failed', job?.id, err.message);
});

console.info('TiSei background worker started');

void (async () => {
  const { overdueQueue, remindersQueue } = await import('./queues.js');
  await overdueQueue.add('check', {}, { repeat: { pattern: '0 * * * *' }, jobId: 'overdue-hourly' });
  await remindersQueue.add('24h', {}, { repeat: { pattern: '0 8 * * *' }, jobId: 'reminder-daily' });
})();

setInterval(() => void handleOverdueCheck(), 60 * 60 * 1000);
setInterval(() => void handleDeadlineReminders(), 60 * 60 * 1000);
