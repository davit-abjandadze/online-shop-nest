import { mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import type { Options } from 'multer';
import { BadRequestException } from '@nestjs/common';

// admin-ის rich-text ედიტორში embed-ული სურათები დისკზე ინახება
// `uploads/notifications/`-ში და main.ts-ში static-ად ემსახურება
// (`/uploads/notifications/<ფაილი>`) — იხ. plans/NOTIFICATIONS_PLAN.md B2.2.
export const NOTIFICATIONS_UPLOAD_SUBDIR = 'notifications';
export const NOTIFICATIONS_UPLOAD_DIR = join(
  process.cwd(),
  'uploads',
  NOTIFICATIONS_UPLOAD_SUBDIR,
);

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export const NOTIFICATION_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const notificationImageMulterOptions: Options = {
  storage: diskStorage({
    destination: (_req, _file, callback) => {
      // ჩვეულებრივ საკმარისია ერთხელ, app boot-ზე შექმნა, მაგრამ recursive
      // mkdir-ი idempotent-ია და ყოველ request-ზე ცალკე migration/init
      // ნაბიჯს არ საჭიროებს — ხარჯი უმნიშვნელოა.
      mkdirSync(NOTIFICATIONS_UPLOAD_DIR, { recursive: true });
      callback(null, NOTIFICATIONS_UPLOAD_DIR);
    },
    filename: (_req, file, callback) => {
      const ext = ALLOWED_MIME_TO_EXT[file.mimetype] ?? '';
      callback(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: {
    fileSize: NOTIFICATION_IMAGE_MAX_SIZE_BYTES,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TO_EXT[file.mimetype]) {
      callback(
        new BadRequestException(
          `დაუშვებელი ფაილის ტიპი: ${file.mimetype}. დაშვებული ტიპები: ${Object.keys(
            ALLOWED_MIME_TO_EXT,
          ).join(', ')}`,
        ),
      );
      return;
    }
    callback(null, true);
  },
};
