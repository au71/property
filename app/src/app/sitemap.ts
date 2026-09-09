import type { MetadataRoute } from 'next';
import { getCategories, getLocationTree, searchListings } from '@/lib/api/queries';

const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

/**
 * The sitemap is the landing pages plus the most recent listings.
 *
 * Every published listing would be more complete but also unbounded; the
 * /buy/{city}/{category} pages already give a crawler a path to all of them,
 * and those are the URLs worth ranking.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/buy`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${siteUrl}/rent`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
  ];

  try {
    const [{ data: regions }, { data: categories }, recent] = await Promise.all([
      getLocationTree(),
      getCategories(),
      searchListings({ limit: 100, sort: 'newest' }),
    ]);

    const cities = regions.flatMap((r) => r.cities);
    const leaves = categories.filter((c) => c.parentId !== null);

    for (const deal of ['buy', 'rent']) {
      for (const city of cities) {
        for (const category of leaves) {
          entries.push({
            url: `${siteUrl}/${deal}/${city.slug}/${category.slug}`,
            lastModified: now,
            changeFrequency: 'daily',
            priority: 0.7,
          });
        }
      }
    }

    for (const listing of recent.data) {
      entries.push({
        url: `${siteUrl}/listing/${listing.publicRef}`,
        lastModified: listing.publishedAt ? new Date(listing.publishedAt) : now,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  } catch {
    // A sitemap that lists the static routes beats a 500 if the API is down.
  }

  return entries;
}
