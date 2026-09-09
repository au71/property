import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { pathParam, validate, validatedBody, validatedQuery } from '../../middleware/validate.js';
import { actorOf, requireAuth } from '../../middleware/auth.js';
import { enquiryLimiter } from '../../middleware/rateLimit.js';
import { badRequest } from '../../lib/errors.js';
import * as service from './service.js';
import type { EnquiryStatus } from '../../generated/prisma/enums.js';

export const listingEnquiryRouter = Router({ mergeParams: true });
export const enquiryRouter = Router();
export const myEnquiryRouter = Router();

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(30),
  email: z.email().optional(),
  message: z.string().trim().min(10, 'Write a short message').max(2000),
  preferredContact: z.enum(['PHONE', 'VIBER', 'EMAIL']).default('PHONE'),
  // Bots fill in every field they find; humans never see this one.
  website: z.string().max(0).optional(),
});

listingEnquiryRouter.post(
  '/',
  enquiryLimiter,
  validate({ params: z.object({ id: z.string().min(1) }), body: createSchema }),
  asyncHandler(async (req, res) => {
    const { website, ...input } = req.body as z.infer<typeof createSchema>;
    if (website) throw badRequest('Enquiry rejected');
    const result = await service.create(pathParam(req, 'id'), input, req.actor?.id ?? null);
    res.status(201).json(result);
  }),
);

const listQuery = z.object({
  listingId: z.string().optional(),
  status: z.enum(['NEW', 'CONTACTED', 'CLOSED', 'SPAM']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

myEnquiryRouter.get(
  '/enquiries/received',
  requireAuth,
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = validatedQuery<z.infer<typeof listQuery>>(res);
    res.json({
      data: await service.listReceived(
        actorOf(req),
        { listingId: q.listingId, status: q.status },
        q.limit,
      ),
    });
  }),
);

myEnquiryRouter.get(
  '/enquiries/sent',
  requireAuth,
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = validatedQuery<z.infer<typeof listQuery>>(res);
    res.json({ data: await service.listSent(actorOf(req), q.limit) });
  }),
);

enquiryRouter.patch(
  '/:id',
  requireAuth,
  validate({
    params: z.object({ id: z.string().min(1) }),
    body: z.object({ status: z.enum(['NEW', 'CONTACTED', 'CLOSED', 'SPAM']) }),
  }),
  asyncHandler(async (req, res) => {
    const { status } = validatedBody<{ status: EnquiryStatus }>(req);
    res.json(await service.updateStatus(actorOf(req), pathParam(req, 'id'), status));
  }),
);
