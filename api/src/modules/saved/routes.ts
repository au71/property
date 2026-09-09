import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { pathParam, validate, validatedBody } from '../../middleware/validate.js';
import { actorOf, requireAuth } from '../../middleware/auth.js';
import { notFound } from '../../lib/errors.js';
import { toListingSummary } from '../listings/dto.js';

export const savedRouter = Router();
export const reportRouter = Router({ mergeParams: true });

savedRouter.use(requireAuth);

savedRouter.get(
  '/saved-listings',
  asyncHandler(async (req, res) => {
    const rows = await prisma.savedListing.findMany({
      where: { userId: actorOf(req).id },
      orderBy: { createdAt: 'desc' },
      include: {
        listing: {
          include: {
            category: { select: { id: true, slug: true, nameEn: true, nameMy: true } },
            township: { select: { id: true, slug: true, nameEn: true, nameMy: true } },
            media: { where: { isCover: true }, take: 1 },
          },
        },
      },
    });
    res.json({ data: rows.map((r) => toListingSummary(r.listing)) });
  }),
);

savedRouter.post(
  '/saved-listings',
  validate({ body: z.object({ listingId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const listing = await prisma.listing.findFirst({
      where: {
        id: validatedBody<{ listingId: string }>(req).listingId,
        status: 'PUBLISHED',
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!listing) throw notFound('Listing');
    // Saving twice is the same end state as saving once.
    await prisma.savedListing.upsert({
      where: { userId_listingId: { userId: actorOf(req).id, listingId: listing.id } },
      create: { userId: actorOf(req).id, listingId: listing.id },
      update: {},
    });
    res.status(204).end();
  }),
);

savedRouter.delete(
  '/saved-listings/:listingId',
  validate({ params: z.object({ listingId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    await prisma.savedListing.deleteMany({
      where: { userId: actorOf(req).id, listingId: pathParam(req, 'listingId') },
    });
    res.status(204).end();
  }),
);

const savedSearchBody = z.object({
  name: z.string().trim().min(2).max(120),
  query: z.record(z.string(), z.unknown()),
  alertFrequency: z.enum(['NONE', 'DAILY', 'WEEKLY']).default('NONE'),
});

savedRouter.get(
  '/saved-searches',
  asyncHandler(async (req, res) => {
    res.json({
      data: await prisma.savedSearch.findMany({
        where: { userId: actorOf(req).id },
        orderBy: { createdAt: 'desc' },
      }),
    });
  }),
);

savedRouter.post(
  '/saved-searches',
  validate({ body: savedSearchBody }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof savedSearchBody>;
    res.status(201).json(
      await prisma.savedSearch.create({
        data: {
          userId: actorOf(req).id,
          name: body.name,
          queryJson: body.query as Prisma.InputJsonValue,
          alertFrequency: body.alertFrequency,
        },
      }),
    );
  }),
);

savedRouter.patch(
  '/saved-searches/:id',
  validate({ params: z.object({ id: z.string() }), body: savedSearchBody.partial() }),
  asyncHandler(async (req, res) => {
    const body = req.body as Partial<z.infer<typeof savedSearchBody>>;
    // Scoped by userId so one user cannot edit another's saved search.
    const updated = await prisma.savedSearch.updateMany({
      where: { id: pathParam(req, 'id'), userId: actorOf(req).id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.query ? { queryJson: body.query as Prisma.InputJsonValue } : {}),
        ...(body.alertFrequency ? { alertFrequency: body.alertFrequency } : {}),
      },
    });
    if (updated.count === 0) throw notFound('Saved search');
    res.json(await prisma.savedSearch.findUnique({ where: { id: pathParam(req, 'id') } }));
  }),
);

savedRouter.delete(
  '/saved-searches/:id',
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    await prisma.savedSearch.deleteMany({
      where: { id: pathParam(req, 'id'), userId: actorOf(req).id },
    });
    res.status(204).end();
  }),
);

reportRouter.post(
  '/',
  requireAuth,
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      reason: z.string().trim().min(3).max(120),
      detail: z.string().trim().max(1000).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const listing = await prisma.listing.findFirst({
      where: {
        OR: [{ id: pathParam(req, 'id') }, { publicRef: pathParam(req, 'id') }],
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!listing) throw notFound('Listing');
    const reportInput = validatedBody<{ reason: string; detail?: string }>(req);
    const report = await prisma.report.create({
      data: {
        listingId: listing.id,
        reporterId: actorOf(req).id,
        reason: reportInput.reason,
        detail: reportInput.detail ?? null,
      },
    });
    res.status(201).json({ id: report.id, status: report.status });
  }),
);
