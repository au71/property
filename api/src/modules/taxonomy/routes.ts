import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validate, validatedQuery } from '../../middleware/validate.js';
import * as service from './service.js';

export const taxonomyRouter = Router();

// Taxonomy is public and effectively static; let clients and any CDN cache it.
const cacheFor = (seconds: number) => `public, max-age=${seconds}, stale-while-revalidate=600`;

taxonomyRouter.get(
  '/categories',
  validate({ query: z.object({ tree: z.enum(['true', 'false']).optional() }) }),
  asyncHandler(async (_req, res) => {
    const { tree } = validatedQuery<{ tree?: 'true' | 'false' }>(res);
    res.setHeader('cache-control', cacheFor(300));
    res.json({
      data: tree === 'true' ? await service.categoryTree() : await service.listCategories(),
    });
  }),
);

taxonomyRouter.get(
  '/locations',
  asyncHandler(async (_req, res) => {
    res.setHeader('cache-control', cacheFor(300));
    res.json({ data: await service.locationTree() });
  }),
);

taxonomyRouter.get(
  '/locations/regions',
  asyncHandler(async (_req, res) => {
    res.setHeader('cache-control', cacheFor(300));
    res.json({ data: await service.listRegions() });
  }),
);

taxonomyRouter.get(
  '/locations/cities',
  validate({ query: z.object({ regionId: z.string().optional() }) }),
  asyncHandler(async (_req, res) => {
    const { regionId } = validatedQuery<{ regionId?: string }>(res);
    res.setHeader('cache-control', cacheFor(300));
    res.json({ data: await service.listCities(regionId) });
  }),
);

taxonomyRouter.get(
  '/locations/townships',
  validate({ query: z.object({ cityId: z.string().optional() }) }),
  asyncHandler(async (_req, res) => {
    const { cityId } = validatedQuery<{ cityId?: string }>(res);
    res.setHeader('cache-control', cacheFor(300));
    res.json({ data: await service.listTownships(cityId) });
  }),
);

taxonomyRouter.get(
  '/amenities',
  asyncHandler(async (_req, res) => {
    res.setHeader('cache-control', cacheFor(300));
    res.json({ data: await service.listAmenities() });
  }),
);
