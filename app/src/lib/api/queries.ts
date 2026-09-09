import 'server-only';
import { apiFetch } from './client';
import type {
  CategoryNode,
  ListingDetail,
  ListingSummary,
  Named,
  Page,
  RegionNode,
} from './types';

/**
 * Server-side data access. Taxonomy is effectively static and safe to cache;
 * listings are not, so they are fetched fresh on every request.
 */

const TAXONOMY_TTL = 300;

export function getCategoryTree(): Promise<{ data: CategoryNode[] }> {
  return apiFetch('/categories', { query: { tree: 'true' }, revalidate: TAXONOMY_TTL });
}

export function getCategories(): Promise<{ data: CategoryNode[] }> {
  return apiFetch('/categories', { revalidate: TAXONOMY_TTL });
}

export function getLocationTree(): Promise<{ data: RegionNode[] }> {
  return apiFetch('/locations', { revalidate: TAXONOMY_TTL });
}

export function getAmenities(): Promise<{ data: Named[] }> {
  return apiFetch('/amenities', { revalidate: TAXONOMY_TTL });
}

export type ListingQuery = Record<string, string | number | string[] | undefined>;

export function searchListings(query: ListingQuery): Promise<Page<ListingSummary>> {
  return apiFetch('/listings', { query });
}

export function getListing(idOrRef: string, token?: string): Promise<ListingDetail> {
  return apiFetch(`/listings/${encodeURIComponent(idOrRef)}`, { token });
}

export function getSimilarListings(idOrRef: string): Promise<{ data: ListingSummary[] }> {
  return apiFetch(`/listings/${encodeURIComponent(idOrRef)}/similar`, { query: { limit: 6 } });
}
