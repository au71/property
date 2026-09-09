import type { components, paths } from './generated/schema';

export type ListingSummary = components['schemas']['ListingSummary'];
export type ListingDetail = components['schemas']['ListingDetail'];
export type AuthResult = components['schemas']['AuthResult'];
export type ApiErrorBody = components['schemas']['Error'];
export type Named = components['schemas']['Named'];
export type SearchQuery = NonNullable<paths['/listings']['get']['parameters']['query']>;

export type DealType = 'SALE' | 'RENT';
export type Role = 'SEEKER' | 'OWNER' | 'AGENT' | 'STAFF' | 'ADMIN';

export interface Page<T> {
  data: T[];
  page: { limit: number; nextCursor: string | null; total?: number };
}

export interface CategoryNode extends Named {
  parentId: string | null;
  fieldSet: 'BUILDING' | 'LAND' | 'COMMERCIAL';
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
}
