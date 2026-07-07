import { Queue } from 'bullmq';
import { getBullMqConnection } from '../config/redis.js';

export const QUEUE_NAMES = {
  geocode: 'tisei-geocode',
  notifications: 'tisei-notifications',
  reminders: 'tisei-reminders',
  overdue: 'tisei-overdue',
} as const;

const connection = getBullMqConnection();

export const geocodeQueue = new Queue(QUEUE_NAMES.geocode, { connection });
export const notificationsQueue = new Queue(QUEUE_NAMES.notifications, { connection });
export const remindersQueue = new Queue(QUEUE_NAMES.reminders, { connection });
export const overdueQueue = new Queue(QUEUE_NAMES.overdue, { connection });
