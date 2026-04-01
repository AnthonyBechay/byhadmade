import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET = process.env.R2_BUCKET_NAME || 'byhadmade';
const PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

export async function uploadToR2(
  buffer: Buffer,
  mimeType: string,
  folder: string,
  ext: string,
  context?: { entityId?: string; label?: string }
): Promise<string> {
  const ts = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '');
  const label = context?.label ? `${context.label}_` : '';
  const entityPart = context?.entityId ? `${context.entityId}/` : '';
  const shortId = crypto.randomUUID().slice(0, 8);
  const key = `${folder}/${entityPart}${label}${ts}_${shortId}${ext}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );
  return `${PUBLIC_URL}/${key}`;
}

export async function deleteFromR2(url: string): Promise<void> {
  if (!url.startsWith(PUBLIC_URL)) return;
  const key = url.replace(`${PUBLIC_URL}/`, '');
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}
