import { prisma } from '../../db/prisma.js';

/**
 * Taxonomy changes roughly never but is requested on every page load, so it is
 * cached in process. A single API instance makes this trivially correct; the
 * cache is cleared whenever an admin writes.
 */
const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.value as T);
  return load().then((value) => {
    cache.set(key, { at: Date.now(), value });
    return value;
  });
}

export function clearTaxonomyCache(): void {
  cache.clear();
}

const nameFields = { id: true, slug: true, nameEn: true, nameMy: true, sortOrder: true } as const;

export function listRegions() {
  return cached('regions', () =>
    prisma.region.findMany({
      where: { isActive: true },
      select: nameFields,
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    }),
  );
}

export function listCities(regionId?: string) {
  return cached(`cities:${regionId ?? 'all'}`, () =>
    prisma.city.findMany({
      where: { isActive: true, ...(regionId ? { regionId } : {}) },
      select: { ...nameFields, regionId: true },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    }),
  );
}

export function listTownships(cityId?: string) {
  return cached(`townships:${cityId ?? 'all'}`, () =>
    prisma.township.findMany({
      where: { isActive: true, ...(cityId ? { cityId } : {}) },
      select: { ...nameFields, cityId: true },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    }),
  );
}

export function listAmenities() {
  return cached('amenities', () =>
    prisma.amenity.findMany({
      select: { ...nameFields, appliesTo: true },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    }),
  );
}

export function listCategories() {
  return cached('categories:flat', () =>
    prisma.category.findMany({
      where: { isActive: true },
      select: { ...nameFields, parentId: true, fieldSet: true, iconKey: true },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    }),
  );
}

export async function categoryTree() {
  const flat = await listCategories();
  const roots = flat.filter((c) => c.parentId === null);
  return roots.map((root) => ({
    ...root,
    children: flat.filter((c) => c.parentId === root.id),
  }));
}

/** Full location hierarchy in one call, for the search filter panel. */
export async function locationTree() {
  const [regions, cities, townships] = await Promise.all([
    listRegions(),
    listCities(),
    listTownships(),
  ]);
  return regions.map((region) => ({
    ...region,
    cities: cities
      .filter((c) => c.regionId === region.id)
      .map((city) => ({
        ...city,
        townships: townships.filter((t) => t.cityId === city.id),
      })),
  }));
}
