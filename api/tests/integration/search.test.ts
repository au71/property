import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import {
  type Taxonomy,
  createListing,
  createUser,
  resetDatabase,
  seedTaxonomy,
} from '../fixtures.js';
import { toFtsQuery } from '../../src/modules/listings/search.js';

let app: Express;
let t: Taxonomy;
let ownerId: string;

beforeAll(() => {
  app = createApp();
});
afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
  t = await seedTaxonomy();
  ownerId = (await createUser('owner@example.com', ['OWNER'])).id;
});

const ids = (body: { data: Array<{ id: string }> }) => body.data.map((l) => l.id);

describe('toFtsQuery', () => {
  it('builds a prefix-matched AND query', () => {
    expect(toFtsQuery('condo bahan')).toBe('"condo"* AND "bahan"*');
  });

  it('neutralises FTS5 operators that would otherwise be a syntax error', () => {
    // A bare `-` starts a NOT clause and an unbalanced quote is a syntax error.
    // Quoting turns every surviving token into a literal, so `OR` searches for
    // the word "or" rather than acting as a disjunction.
    expect(toFtsQuery('condo -"bahan OR')).toBe('"condo"* AND "bahan"* AND "or"*');
    expect(toFtsQuery('NEAR/2 lake')).toBe('"near"* AND "lake"*');
  });

  it('returns null when nothing usable remains', () => {
    expect(toFtsQuery('* - "')).toBeNull();
    expect(toFtsQuery('a')).toBeNull();
  });

  it('caps the number of terms', () => {
    const q = toFtsQuery('aa bb cc dd ee ff gg hh ii jj kk');
    expect(q?.split(' AND ')).toHaveLength(8);
  });
});

describe('filters', () => {
  beforeEach(async () => {
    await createListing(t, ownerId, {
      title: 'Cheap condominium in Bahan',
      priceAmount: 100_000_000n,
      bedrooms: 1,
      dealType: 'SALE',
      townshipId: t.bahanId,
    });
    await createListing(t, ownerId, {
      title: 'Mid range condominium in Yankin',
      priceAmount: 500_000_000n,
      bedrooms: 3,
      dealType: 'SALE',
      townshipId: t.yankinId,
    });
    await createListing(t, ownerId, {
      title: 'Expensive rental house in Bahan',
      priceAmount: 900_000_000n,
      bedrooms: 5,
      dealType: 'RENT',
      rentPeriod: 'MONTHLY',
      townshipId: t.bahanId,
    });
    await createListing(t, ownerId, {
      title: 'A draft that must never appear',
      status: 'DRAFT',
      publishedAt: null,
    });
    await createListing(t, ownerId, {
      title: 'A pending listing that must never appear',
      status: 'PENDING_REVIEW',
      publishedAt: null,
    });
  });

  it('returns only published listings', async () => {
    const res = await request(app).get('/api/v1/listings').expect(200);
    expect(res.body.data).toHaveLength(3);
    for (const l of res.body.data) expect(l.status).toBe('PUBLISHED');
  });

  it('filters by deal type', async () => {
    const res = await request(app).get('/api/v1/listings?dealType=RENT').expect(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('filters by a price range', async () => {
    const res = await request(app)
      .get('/api/v1/listings?minPrice=200000000&maxPrice=600000000')
      .expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].price.amount).toBe('500000000');
  });

  it('filters by township slug', async () => {
    const res = await request(app).get('/api/v1/listings?townshipSlug=bahan').expect(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('accepts repeated and comma-separated multi-values alike', async () => {
    const comma = await request(app)
      .get(`/api/v1/listings?townshipId=${t.bahanId},${t.yankinId}`)
      .expect(200);
    const repeated = await request(app)
      .get(`/api/v1/listings?townshipId=${t.bahanId}&townshipId=${t.yankinId}`)
      .expect(200);
    expect(ids(comma.body).sort()).toEqual(ids(repeated.body).sort());
    expect(comma.body.data).toHaveLength(3);
  });

  it('filters by minimum bedrooms', async () => {
    const res = await request(app).get('/api/v1/listings?bedroomsMin=3').expect(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('matches a parent category slug against its children', async () => {
    const res = await request(app).get('/api/v1/listings?categorySlug=residential').expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('filters by city', async () => {
    const res = await request(app).get('/api/v1/listings?citySlug=yangon').expect(200);
    expect(res.body.data).toHaveLength(3);
  });

  it('rejects a malformed price', async () => {
    await request(app).get('/api/v1/listings?minPrice=abc').expect(400);
  });
});

describe('full-text search', () => {
  beforeEach(async () => {
    await createListing(t, ownerId, { title: 'Spacious condominium near the lake' });
    await createListing(t, ownerId, { title: 'Warehouse with loading bay' });
    await createListing(t, ownerId, {
      title: 'Family house with garden',
      description: 'A quiet property close to the international school and the market.',
    });
  });

  it('matches on a title word', async () => {
    const res = await request(app).get('/api/v1/listings?q=warehouse').expect(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('prefix-matches, so "condo" finds "condominium"', async () => {
    const res = await request(app).get('/api/v1/listings?q=condo').expect(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('matches on description text', async () => {
    const res = await request(app).get('/api/v1/listings?q=international%20school').expect(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns nothing — not everything — when there are no matches', async () => {
    // The dangerous failure mode: an empty candidate list must narrow, not widen.
    const res = await request(app).get('/api/v1/listings?q=zzzznotathing').expect(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('survives FTS5 syntax characters in user input', async () => {
    for (const q of ['"', '-', 'a OR b', '*', 'condo NEAR/2 lake', '((']) {
      const res = await request(app).get(`/api/v1/listings?q=${encodeURIComponent(q)}`);
      expect(res.status).toBe(200);
    }
  });

  it('keeps the index in step when a listing is edited', async () => {
    const listing = await createListing(t, ownerId, { title: 'Original bungalow title' });
    expect((await request(app).get('/api/v1/listings?q=bungalow')).body.data).toHaveLength(1);

    await prisma.listing.update({
      where: { id: listing.id },
      data: { title: 'Renamed penthouse title', titleNormalized: 'renamed penthouse title' },
    });

    expect((await request(app).get('/api/v1/listings?q=bungalow')).body.data).toHaveLength(0);
    expect((await request(app).get('/api/v1/listings?q=penthouse')).body.data).toHaveLength(1);
  });

  it('drops a deleted listing out of the index', async () => {
    const listing = await createListing(t, ownerId, { title: 'Temporary chalet listing' });
    expect((await request(app).get('/api/v1/listings?q=chalet')).body.data).toHaveLength(1);
    await prisma.listing.delete({ where: { id: listing.id } });
    expect((await request(app).get('/api/v1/listings?q=chalet')).body.data).toHaveLength(0);
  });
});

describe('sorting and pagination', () => {
  beforeEach(async () => {
    for (let i = 0; i < 12; i += 1) {
      await createListing(t, ownerId, {
        title: `Listing number ${i} in Bahan`,
        priceAmount: BigInt((i + 1) * 10_000_000),
        floorAreaSqft: 500 + i * 100,
        publishedAt: new Date(Date.now() - i * 60_000),
        isFeatured: i === 5,
      });
    }
  });

  it('sorts by price ascending', async () => {
    const res = await request(app).get('/api/v1/listings?sort=priceAsc&limit=20').expect(200);
    const prices = res.body.data.map((l: { price: { amount: string } }) => BigInt(l.price.amount));
    expect(prices).toEqual([...prices].sort((a, b) => (a < b ? -1 : 1)));
  });

  it('sorts by price descending', async () => {
    const res = await request(app).get('/api/v1/listings?sort=priceDesc&limit=20').expect(200);
    const prices = res.body.data.map((l: { price: { amount: string } }) => BigInt(l.price.amount));
    expect(prices).toEqual([...prices].sort((a, b) => (a > b ? -1 : 1)));
  });

  it('puts featured listings first by default', async () => {
    const res = await request(app).get('/api/v1/listings?limit=20').expect(200);
    expect(res.body.data[0].isFeatured).toBe(true);
  });

  it('pages without repeating or skipping rows', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let guard = 0;

    do {
      const url: string = `/api/v1/listings?limit=5${cursor ? `&cursor=${cursor}` : ''}`;
      const res = await request(app).get(url).expect(200);
      seen.push(...ids(res.body));
      cursor = res.body.page.nextCursor;
      guard += 1;
    } while (cursor && guard < 10);

    expect(seen).toHaveLength(12);
    expect(new Set(seen).size).toBe(12);
  });

  it('pages correctly when sorted by price', async () => {
    const first = await request(app).get('/api/v1/listings?sort=priceAsc&limit=5').expect(200);
    const second = await request(app)
      .get(`/api/v1/listings?sort=priceAsc&limit=5&cursor=${first.body.page.nextCursor}`)
      .expect(200);

    const overlap = ids(first.body).filter((id) => ids(second.body).includes(id));
    expect(overlap).toHaveLength(0);

    const lastOfFirst = BigInt(first.body.data.at(-1).price.amount);
    const firstOfSecond = BigInt(second.body.data[0].price.amount);
    expect(firstOfSecond).toBeGreaterThan(lastOfFirst);
  });

  it('reports no next cursor on the final page', async () => {
    const res = await request(app).get('/api/v1/listings?limit=50').expect(200);
    expect(res.body.page.nextCursor).toBeNull();
  });

  it('rejects a malformed cursor rather than ignoring it', async () => {
    await request(app).get('/api/v1/listings?cursor=!!!notbase64!!!').expect(400);
  });

  it('caps an oversized limit', async () => {
    await request(app).get('/api/v1/listings?limit=5000').expect(400);
  });

  it('returns totals and facet counts on request', async () => {
    const res = await request(app).get('/api/v1/listings?withFacets=true&limit=2').expect(200);
    expect(res.body.page.total).toBe(12);
    expect(res.body.facets.townships.length).toBeGreaterThan(0);
    expect(res.body.data).toHaveLength(2);
  });
});
