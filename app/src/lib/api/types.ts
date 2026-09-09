import type { components, paths } from './generated/schema';

/**
 * Names for the shapes the generated schema describes, so application code
 * refers to `ListingSummary` rather than a deep path into the generated tree.
 */
export type ListingSummary = components['schemas']['ListingSummary'];
export type ListingDetail = components['schemas']['ListingDetail'];
export type AuthResult = components['schemas']['AuthResult'];
export type ApiErrorBody = components['schemas']['Error'];
export type Named = components['schemas']['Named'];

export type SearchParams = NonNullable<paths['/listings']['get']['parameters']['query']>;

export type DealType = 'SALE' | 'RENT';
export type Role = 'SEEKER' | 'OWNER' | 'AGENT' | 'STAFF' | 'ADMIN';
export type ListingStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'SOLD'
  | 'RENTED'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'ARCHIVED';

export interface Page<T> {
  data: T[];
  page: { limit: number; nextCursor: string | null; total?: number };
  facets?: {
    categories: Array<{ id: string; count: number }>;
    townships: Array<{ id: string; count: number }>;
    dealTypes: Array<{ dealType: DealType; count: number }>;
  };
}

export interface CategoryNode extends Named {
  parentId: string | null;
  fieldSet: 'BUILDING' | 'LAND' | 'COMMERCIAL';
  iconKey?: string | null;
  children?: CategoryNode[];
}

export interface TownshipNode extends Named {
  cityId: string;
}
export interface CityNode extends Named {
  regionId: string;
  townships: TownshipNode[];
}
export interface RegionNode extends Named {
  cities: CityNode[];
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  roles: Role[];
  preferredLang: string;
  isVerified: boolean;
  agentProfile?: { agencyName: string | null; isVerifiedAgent: boolean } | null;
}
