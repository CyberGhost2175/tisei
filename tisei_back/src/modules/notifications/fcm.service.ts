import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPrivateKey } from 'node:crypto';
import admin from 'firebase-admin';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';

let initialized = false;
let initAttempted = false;

function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  // Support both literal \n sequences and already-expanded multiline keys.
  return key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
}

function assertUsablePrivateKey(privateKey: string): void {
  try {
    createPrivateKey(privateKey);
  } catch (err) {
    throw new Error(
      `FIREBASE_PRIVATE_KEY is invalid/corrupt (${err instanceof Error ? err.message : String(err)}). ` +
        'Re-download the service account JSON from Firebase Console and set FIREBASE_SERVICE_ACCOUNT_PATH ' +
        'to that file (preferred), or paste a fresh private_key with \\n escaping.',
    );
  }
}

function loadServiceAccountFromPath(pathValue: string): admin.ServiceAccount {
  const absolute = resolve(pathValue);
  if (!existsSync(absolute)) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH not found: ${absolute}`);
  }
  const parsed = JSON.parse(readFileSync(absolute, 'utf8')) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error('Service account JSON missing project_id / client_email / private_key');
  }
  const privateKey = normalizePrivateKey(parsed.private_key);
  assertUsablePrivateKey(privateKey);
  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey,
  };
}

/** Lazily init Firebase Admin. Returns false if credentials are not configured. */
export function ensureFirebase(): boolean {
  if (initialized) return true;
  if (initAttempted) return false;
  initAttempted = true;

  try {
    if (admin.apps.length > 0) {
      initialized = true;
      return true;
    }

    if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      admin.initializeApp({
        credential: admin.credential.cert(loadServiceAccountFromPath(env.FIREBASE_SERVICE_ACCOUNT_PATH)),
      });
      initialized = true;
      // eslint-disable-next-line no-console
      console.info('[fcm] Firebase Admin ready (service account file)');
      return true;
    }

    if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const creds = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as admin.ServiceAccount & {
        privateKey?: string;
        private_key?: string;
      };
      const privateKey = normalizePrivateKey(
        String(creds.privateKey ?? creds.private_key ?? ''),
      );
      assertUsablePrivateKey(privateKey);
      admin.initializeApp({
        credential: admin.credential.cert({
          ...creds,
          privateKey,
        }),
      });
      initialized = true;
      // eslint-disable-next-line no-console
      console.info('[fcm] Firebase Admin ready (service account JSON)');
      return true;
    }

    if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
      const privateKey = normalizePrivateKey(env.FIREBASE_PRIVATE_KEY);
      assertUsablePrivateKey(privateKey);
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
      initialized = true;
      // eslint-disable-next-line no-console
      console.info('[fcm] Firebase Admin ready (env fields)');
      return true;
    }

    // eslint-disable-next-line no-console
    console.warn(
      '[fcm] Firebase credentials not configured — push delivery disabled (inbox still works)',
    );
    return false;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[fcm] Failed to initialize Firebase Admin:', err);
    return false;
  }
}

export type PushPayload = {
  title: string;
  body: string;
  /** FCM data values must be strings */
  data?: Record<string, string>;
};

const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

/**
 * Send FCM push to all registered devices of the given users.
 * Invalid tokens are pruned automatically. Never throws — push must not break business flows.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<{ sent: number; pruned: number }> {
  if (userIds.length === 0) return { sent: 0, pruned: 0 };
  if (!ensureFirebase()) return { sent: 0, pruned: 0 };

  const rows = await prisma.devicePushToken.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, token: true },
  });

  if (rows.length === 0) {
    // eslint-disable-next-line no-console
    console.warn(`[fcm] no device tokens for ${userIds.length} user(s) — skip push`);
    return { sent: 0, pruned: 0 };
  }

  const tokens = rows.map((r) => r.token);
  const tokenToId = new Map(rows.map((r) => [r.token, r.id]));

  let sent = 0;
  const toPrune: string[] = [];

  // FCM multicast limit is 500 tokens per request
  const chunkSize = 500;
  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize);
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'tisei_alerts',
            priority: 'high',
            defaultVibrateTimings: true,
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'alert',
          },
          payload: {
            aps: {
              alert: {
                title: payload.title,
                body: payload.body,
              },
              sound: 'default',
              badge: 1,
            },
          },
        },
      });

      sent += response.successCount;

      response.responses.forEach((res, idx) => {
        if (res.success) return;
        const code = res.error?.code;
        const message = res.error?.message;
        // eslint-disable-next-line no-console
        console.error(`[fcm] token send failed: ${code ?? 'unknown'} ${message ?? ''}`);
        if (code && INVALID_TOKEN_CODES.has(code)) {
          const id = tokenToId.get(chunk[idx]!);
          if (id) toPrune.push(id);
        }
      });

      // eslint-disable-next-line no-console
      console.info(
        `[fcm] multicast ok=${response.successCount} fail=${response.failureCount} title="${payload.title}"`,
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[fcm] sendEachForMulticast failed:', err);
    }
  }

  if (toPrune.length > 0) {
    await prisma.devicePushToken.deleteMany({ where: { id: { in: toPrune } } });
  }

  return { sent, pruned: toPrune.length };
}
