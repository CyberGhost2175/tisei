import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { BadRequestError } from '../errors/AppError.js';

let client: S3Client | null = null;

function getS3Client(): S3Client {
  if (client) return client;

  const customEndpoint =
    env.S3_ENDPOINT &&
    !env.S3_ENDPOINT.includes('amazonaws.com') &&
    !env.S3_ENDPOINT.includes('localhost');

  client = new S3Client({
    region: env.S3_REGION,
    ...(customEndpoint
      ? { endpoint: env.S3_ENDPOINT, forcePathStyle: env.S3_FORCE_PATH_STYLE }
      : { forcePathStyle: env.S3_FORCE_PATH_STYLE }),
    credentials:
      env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
        : undefined,
  });

  return client;
}

function getPublicBaseUrl(): string {
  if (env.S3_PUBLIC_URL) return env.S3_PUBLIC_URL.replace(/\/$/, '');

  if (env.S3_FORCE_PATH_STYLE) {
    const endpoint =
      env.S3_ENDPOINT?.replace(/\/$/, '') ?? `https://s3.${env.S3_REGION}.amazonaws.com`;
    return `${endpoint}/${env.S3_BUCKET}`;
  }

  return `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com`;
}

export function extractS3KeyFromUrl(url: string): string {
  const u = new URL(url);
  let path = decodeURIComponent(u.pathname.replace(/^\//, ''));
  if (path.startsWith(`${env.S3_BUCKET}/`)) {
    path = path.slice(env.S3_BUCKET.length + 1);
  }
  return path;
}

export async function getPresignedReadUrl(key: string, expiresIn = 60 * 60 * 24): Promise<string> {
  const s3 = getS3Client();
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    { expiresIn },
  );
}

export async function resolveAttachmentUrl(storedUrl: string): Promise<string> {
  try {
    const key = extractS3KeyFromUrl(storedUrl);
    return await getPresignedReadUrl(key);
  } catch {
    return storedUrl;
  }
}

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/3gpp',
  'video/x-msvideo',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024; // 100 MB

function resolveMimeType(mimeType: string, fileName: string): string {
  if (mimeType && mimeType !== 'application/octet-stream') return mimeType;
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) return 'video/mp4';
  if (lower.endsWith('.mov') || lower.endsWith('.qt')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.3gp')) return 'video/3gpp';
  if (lower.endsWith('.avi')) return 'video/x-msvideo';
  return mimeType || 'application/octet-stream';
}

export interface UploadResult {
  url: string;
  key: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
}

export async function uploadToS3(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<UploadResult> {
  const resolvedMime = resolveMimeType(mimeType, fileName);
  if (!ALLOWED_MIME.has(resolvedMime)) {
    throw new BadRequestError(`Тип файла не поддерживается: ${resolvedMime}`);
  }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new BadRequestError('Размер файла превышает 100 МБ');
  }

  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
  const key = `requests/${randomUUID()}${ext}`;

  const s3 = getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: resolvedMime,
    }),
  );

  const baseUrl = getPublicBaseUrl();
  const url = `${baseUrl}/${key}`;

  return { url, key, fileName, fileType: resolvedMime, sizeBytes: buffer.length };
}

export async function deleteFromS3(key: string): Promise<void> {
  const s3 = getS3Client();
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}
