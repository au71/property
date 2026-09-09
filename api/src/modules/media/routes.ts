import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { pathParam, validate, validatedBody } from '../../middleware/validate.js';
import { actorOf, requireAuth } from '../../middleware/auth.js';
import { uploadLimiter } from '../../middleware/rateLimit.js';
import { badRequest } from '../../lib/errors.js';
import { MAX_IMAGES_PER_LISTING, MAX_UPLOAD_BYTES, addImages, remove, reorder } from './service.js';

export const listingMediaRouter = Router({ mergeParams: true });
export const mediaRouter = Router();

// Files are held in memory: they are re-encoded immediately and never written
// in their original form, so a temp file would only be one more thing to clean.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_IMAGES_PER_LISTING },
});

const idParam = z.object({ id: z.string().min(1) });

listingMediaRouter.post(
  '/',
  requireAuth,
  uploadLimiter,
  validate({ params: idParam }),
  upload.array('files', MAX_IMAGES_PER_LISTING),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw badRequest('Attach at least one image in the "files" field');
    const created = await addImages(actorOf(req), pathParam(req, 'id'), files);
    res.status(201).json({ data: created });
  }),
);

listingMediaRouter.patch(
  '/reorder',
  requireAuth,
  validate({ params: idParam, body: z.object({ orderedIds: z.array(z.string()).min(1) }) }),
  asyncHandler(async (req, res) => {
    const { orderedIds } = validatedBody<{ orderedIds: string[] }>(req);
    res.json({ data: await reorder(actorOf(req), pathParam(req, 'id'), orderedIds) });
  }),
);

mediaRouter.delete(
  '/:id',
  requireAuth,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await remove(actorOf(req), pathParam(req, 'id'));
    res.status(204).end();
  }),
);
