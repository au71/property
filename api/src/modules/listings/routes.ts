import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { pathParam, validate, validatedBody, validatedQuery } from '../../middleware/validate.js';
import { actorOf, requireAuth } from '../../middleware/auth.js';
import { contactLimiter } from '../../middleware/rateLimit.js';
import * as service from './service.js';
import {
  createListingSchema,
  idParamSchema,
  listingStatusSchema,
  searchQuerySchema,
  updateListingSchema,
} from './schema.js';
import type { CreateListingInput, SearchQuery, UpdateListingInput } from './schema.js';
import type { ListingStatus } from '../../generated/prisma/enums.js';

export const listingsRouter = Router();
export const myListingsRouter = Router();

listingsRouter.get(
  '/',
  validate({ query: searchQuerySchema }),
  asyncHandler(async (_req, res) => {
    res.json(await service.search(validatedQuery<SearchQuery>(res)));
  }),
);

listingsRouter.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.getByIdOrRef(pathParam(req, 'id'), req.actor ?? null));
  }),
);

listingsRouter.get(
  '/:id/similar',
  validate({
    params: idParamSchema,
    query: z.object({ limit: z.coerce.number().min(1).max(20).default(6) }),
  }),
  asyncHandler(async (req, res) => {
    const { limit } = validatedQuery<{ limit: number }>(res);
    res.json({ data: await service.similarTo(pathParam(req, 'id'), limit) });
  }),
);

listingsRouter.get(
  '/:id/contact',
  contactLimiter,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.revealContact(pathParam(req, 'id'), req.actor ?? null));
  }),
);

listingsRouter.post(
  '/:id/view',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await service.recordView(pathParam(req, 'id'));
    res.status(204).end();
  }),
);

listingsRouter.post(
  '/',
  requireAuth,
  validate({ body: createListingSchema }),
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(await service.create(actorOf(req), validatedBody<CreateListingInput>(req)));
  }),
);

listingsRouter.patch(
  '/:id',
  requireAuth,
  validate({ params: idParamSchema, body: updateListingSchema }),
  asyncHandler(async (req, res) => {
    res.json(
      await service.update(
        actorOf(req),
        pathParam(req, 'id'),
        validatedBody<UpdateListingInput>(req),
      ),
    );
  }),
);

listingsRouter.post(
  '/:id/submit',
  requireAuth,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.submitForReview(actorOf(req), pathParam(req, 'id')));
  }),
);

listingsRouter.post(
  '/:id/renew',
  requireAuth,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.renew(actorOf(req), pathParam(req, 'id')));
  }),
);

listingsRouter.post(
  '/:id/status',
  requireAuth,
  validate({ params: idParamSchema, body: listingStatusSchema }),
  asyncHandler(async (req, res) => {
    const { status } = validatedBody<{ status: ListingStatus }>(req);
    res.json(await service.changeStatus(actorOf(req), pathParam(req, 'id'), status));
  }),
);

listingsRouter.delete(
  '/:id',
  requireAuth,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await service.softDelete(actorOf(req), pathParam(req, 'id'));
    res.status(204).end();
  }),
);

const myListingsQuery = z.object({
  status: z
    .enum([
      'DRAFT',
      'PENDING_REVIEW',
      'PUBLISHED',
      'REJECTED',
      'SOLD',
      'RENTED',
      'EXPIRED',
      'SUSPENDED',
      'ARCHIVED',
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

myListingsRouter.get(
  '/listings',
  requireAuth,
  validate({ query: myListingsQuery }),
  asyncHandler(async (req, res) => {
    const { status, limit } = validatedQuery<z.infer<typeof myListingsQuery>>(res);
    const actor = actorOf(req);
    const [data, counts, quota] = await Promise.all([
      service.listMine(actor, status, limit),
      service.statusCounts(actor),
      service.remainingQuota(actor),
    ]);
    res.json({ data, counts, quota });
  }),
);
