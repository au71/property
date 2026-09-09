import sharp from 'sharp';
import { prisma } from '../../db/prisma.js';
import { storage } from '../../lib/storage.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { canEditListing, type Actor } from '../../domain/policy.js';

export const MAX_IMAGES_PER_LISTING = 15;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const DISPLAY_WIDTH = 1600;
const THUMB_WIDTH = 400;

/**
 * File extensions and client-supplied MIME types are both trivially forged, so
 * the format is taken from the decoded image itself.
 */
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'gif', 'tiff']);

export async function addImages(
  actor: Actor,
  listingId: string,
  files: Array<{ buffer: Buffer; originalname: string }>,
) {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, deletedAt: null },
    select: { id: true, publicRef: true, ownerId: true, createdById: true, status: true },
  });
  if (!listing) throw notFound('Listing');
  if (!canEditListing(actor, listing)) throw forbidden('You cannot add photos to this listing');

  const existing = await prisma.media.count({ where: { listingId } });
  if (existing + files.length > MAX_IMAGES_PER_LISTING) {
    throw badRequest(
      `A listing can have at most ${MAX_IMAGES_PER_LISTING} photos (it already has ${existing})`,
    );
  }

  const created = [];
  let sortOrder = existing;

  for (const file of files) {
    // sharp throws rather than returning empty metadata when the bytes are not
    // an image at all, so a corrupt or spoofed upload must be caught here or it
    // surfaces as a 500 instead of a useful validation error.
    let meta;
    try {
      meta = await sharp(file.buffer, { failOn: 'error' }).metadata();
    } catch {
      throw badRequest(`${file.originalname} could not be read as an image`);
    }
    if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
      throw badRequest(`${file.originalname} is not a supported image`);
    }
    if (!meta.width || !meta.height) throw badRequest(`${file.originalname} is not a valid image`);

    // rotate() applies the EXIF orientation, and the re-encode drops all other
    // EXIF — including any GPS coordinates the seller did not mean to publish.
    const pipeline = sharp(file.buffer).rotate();

    const displayBuffer = await pipeline
      .clone()
      .resize({ width: DISPLAY_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const thumbBuffer = await pipeline
      .clone()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();

    const displayMeta = await sharp(displayBuffer).metadata();

    const base = `listings/${listing.publicRef}/${Date.now()}-${sortOrder}`;
    const stored = await storage.put(`${base}.webp`, displayBuffer, 'image/webp');
    const storedThumb = await storage.put(`${base}-thumb.webp`, thumbBuffer, 'image/webp');

    created.push(
      await prisma.media.create({
        data: {
          listingId,
          url: stored.url,
          thumbUrl: storedThumb.url,
          width: displayMeta.width ?? DISPLAY_WIDTH,
          height: displayMeta.height ?? 0,
          bytes: displayBuffer.byteLength,
          sortOrder,
          isCover: existing === 0 && sortOrder === 0,
        },
      }),
    );
    sortOrder += 1;
  }

  return created;
}

export async function reorder(actor: Actor, listingId: string, orderedIds: string[]) {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, deletedAt: null },
    select: { id: true, ownerId: true, createdById: true, status: true },
  });
  if (!listing) throw notFound('Listing');
  if (!canEditListing(actor, listing)) throw forbidden('You cannot reorder these photos');

  const media = await prisma.media.findMany({ where: { listingId }, select: { id: true } });
  const known = new Set(media.map((m) => m.id));
  if (orderedIds.length !== known.size || orderedIds.some((id) => !known.has(id))) {
    throw badRequest('The photo list must contain every photo on this listing exactly once');
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.media.update({ where: { id }, data: { sortOrder: index, isCover: index === 0 } }),
    ),
  );

  return prisma.media.findMany({ where: { listingId }, orderBy: { sortOrder: 'asc' } });
}

export async function remove(actor: Actor, mediaId: string): Promise<void> {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      url: true,
      thumbUrl: true,
      listingId: true,
      isCover: true,
      listing: { select: { id: true, ownerId: true, createdById: true, status: true } },
    },
  });
  if (!media) throw notFound('Photo');
  if (!canEditListing(actor, media.listing)) throw forbidden('You cannot delete this photo');

  await prisma.media.delete({ where: { id: mediaId } });

  // Promote the next photo so a listing is never left without a cover.
  if (media.isCover) {
    const next = await prisma.media.findFirst({
      where: { listingId: media.listingId },
      orderBy: { sortOrder: 'asc' },
    });
    if (next) await prisma.media.update({ where: { id: next.id }, data: { isCover: true } });
  }

  // Storage keys are derived from the URL; failing to remove the bytes must not
  // fail the request, since the database row is already gone.
  for (const url of [media.url, media.thumbUrl]) {
    const key = url.split('/media/')[1];
    if (key) await storage.remove(key).catch(() => undefined);
  }
}
