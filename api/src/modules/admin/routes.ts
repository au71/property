import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { pathParam, validate, validatedBody, validatedQuery } from '../../middleware/validate.js';
import { actorOf, requireRole } from '../../middleware/auth.js';
import * as service from './service.js';
import type { ReportStatus, Role } from '../../generated/prisma/enums.js';

export const adminRouter = Router();

// Everything below is staff-only; the admin-only actions check again in the
// service, so a route mounted carelessly still cannot escalate.
adminRouter.use(requireRole('STAFF', 'ADMIN'));

const idParam = z.object({ id: z.string().min(1) });
const reasonBody = z.object({ reason: z.string().trim().min(5, 'Give a reason').max(500) });

const queueQuery = z.object({
  status: z
    .enum(['PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'DRAFT', 'SUSPENDED', 'EXPIRED'])
    .default('PENDING_REVIEW'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

adminRouter.get(
  '/listings',
  validate({ query: queueQuery }),
  asyncHandler(async (_req, res) => {
    const q = validatedQuery<z.infer<typeof queueQuery>>(res);
    res.json(await service.moderationQueue(q.status, q.limit, q.cursor));
  }),
);

adminRouter.post(
  '/listings/:id/approve',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json(await service.approve(actorOf(req), pathParam(req, 'id')));
  }),
);

adminRouter.post(
  '/listings/:id/reject',
  validate({ params: idParam, body: reasonBody }),
  asyncHandler(async (req, res) => {
    const { reason } = validatedBody<{ reason: string }>(req);
    res.json(await service.reject(actorOf(req), pathParam(req, 'id'), reason));
  }),
);

adminRouter.post(
  '/listings/:id/suspend',
  validate({ params: idParam, body: reasonBody }),
  asyncHandler(async (req, res) => {
    const { reason } = validatedBody<{ reason: string }>(req);
    res.json(await service.suspend(actorOf(req), pathParam(req, 'id'), reason));
  }),
);

adminRouter.post(
  '/listings/:id/feature',
  validate({
    params: idParam,
    body: z.object({ days: z.number().int().min(0).max(365).default(30) }),
  }),
  asyncHandler(async (req, res) => {
    const { days } = validatedBody<{ days: number }>(req);
    res.json(await service.feature(actorOf(req), pathParam(req, 'id'), days));
  }),
);

const reportQuery = z.object({
  status: z.enum(['OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

adminRouter.get(
  '/reports',
  validate({ query: reportQuery }),
  asyncHandler(async (_req, res) => {
    const q = validatedQuery<z.infer<typeof reportQuery>>(res);
    res.json({ data: await service.listReports(q.status, q.limit) });
  }),
);

adminRouter.patch(
  '/reports/:id',
  validate({
    params: idParam,
    body: z.object({ status: z.enum(['OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED']) }),
  }),
  asyncHandler(async (req, res) => {
    const { status } = validatedBody<{ status: ReportStatus }>(req);
    res.json(await service.updateReport(actorOf(req), pathParam(req, 'id'), status));
  }),
);

const userQuery = z.object({
  search: z.string().trim().max(120).optional(),
  role: z.enum(['SEEKER', 'OWNER', 'AGENT', 'STAFF', 'ADMIN']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

adminRouter.get(
  '/users',
  validate({ query: userQuery }),
  asyncHandler(async (_req, res) => {
    const q = validatedQuery<z.infer<typeof userQuery>>(res);
    res.json({ data: await service.listUsers(q.search, q.role, q.limit) });
  }),
);

adminRouter.patch(
  '/users/:id/roles',
  validate({
    params: idParam,
    body: z.object({
      roles: z.array(z.enum(['SEEKER', 'OWNER', 'AGENT', 'STAFF', 'ADMIN'])).min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { roles } = validatedBody<{ roles: Role[] }>(req);
    res.json(await service.setRoles(actorOf(req), pathParam(req, 'id'), roles));
  }),
);

adminRouter.patch(
  '/users/:id/status',
  validate({ params: idParam, body: z.object({ isActive: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    const { isActive } = validatedBody<{ isActive: boolean }>(req);
    res.json(await service.setUserActive(actorOf(req), pathParam(req, 'id'), isActive));
  }),
);

adminRouter.post(
  '/agents/:id/verify',
  validate({ params: idParam, body: z.object({ verified: z.boolean().default(true) }) }),
  asyncHandler(async (req, res) => {
    const { verified } = validatedBody<{ verified: boolean }>(req);
    res.json(await service.verifyAgent(actorOf(req), pathParam(req, 'id'), verified));
  }),
);

adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    res.json(await service.stats());
  }),
);

const activeBody = z.object({ isActive: z.boolean() });

adminRouter.patch(
  '/locations/cities/:id',
  validate({ params: idParam, body: activeBody }),
  asyncHandler(async (req, res) => {
    const { isActive } = validatedBody<{ isActive: boolean }>(req);
    res.json(await service.setCityActive(actorOf(req), pathParam(req, 'id'), isActive));
  }),
);

adminRouter.patch(
  '/locations/townships/:id',
  validate({ params: idParam, body: activeBody }),
  asyncHandler(async (req, res) => {
    const { isActive } = validatedBody<{ isActive: boolean }>(req);
    res.json(await service.setTownshipActive(actorOf(req), pathParam(req, 'id'), isActive));
  }),
);

adminRouter.patch(
  '/categories/:id',
  validate({ params: idParam, body: activeBody }),
  asyncHandler(async (req, res) => {
    const { isActive } = validatedBody<{ isActive: boolean }>(req);
    res.json(await service.setCategoryActive(actorOf(req), pathParam(req, 'id'), isActive));
  }),
);
