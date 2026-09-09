import { z } from 'zod';

/**
 * Accepts `?townshipId=a,b` and `?townshipId=a&townshipId=b` alike, since both
 * forms turn up in the wild and neither is worth rejecting.
 */
const csvList = () =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v): string[] | undefined => {
      if (v == null) return undefined;
      const list = Array.isArray(v) ? v : v.split(',');
      const cleaned = list.map((s) => s.trim()).filter(Boolean);
      return cleaned.length > 0 ? cleaned : undefined;
    });

export const sortOptions = ['newest', 'priceAsc', 'priceDesc', 'areaDesc', 'relevance'] as const;
export type SortOption = (typeof sortOptions)[number];

export const searchQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  dealType: z.enum(['SALE', 'RENT']).optional(),
  categoryId: csvList(),
  categorySlug: csvList(),
  regionId: z.string().optional(),
  cityId: z.string().optional(),
  citySlug: z.string().optional(),
  townshipId: csvList(),
  townshipSlug: csvList(),
  amenityId: csvList(),

  // Prices arrive as strings because a MMK amount can exceed Number precision.
  minPrice: z.string().regex(/^\d+$/).optional(),
  maxPrice: z.string().regex(/^\d+$/).optional(),

  bedroomsMin: z.coerce.number().int().min(0).max(20).optional(),
  bathroomsMin: z.coerce.number().int().min(0).max(20).optional(),
  minAreaSqft: z.coerce.number().int().min(0).optional(),
  maxAreaSqft: z.coerce.number().int().min(0).optional(),
  furnishing: z.enum(['NONE', 'PARTIAL', 'FULL']).optional(),
  isFeatured: z.enum(['true', 'false']).optional(),
  postedWithinDays: z.coerce.number().int().min(1).max(365).optional(),

  sort: z.enum(sortOptions).default('newest'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  withFacets: z.enum(['true', 'false']).optional(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

const priceString = z
  .union([
    z.string().regex(/^\d+$/, 'Price must be a whole number'),
    z.number().int().nonnegative(),
  ])
  .transform((v) => BigInt(v));

const baseListingFields = {
  dealType: z.enum(['SALE', 'RENT']),
  categoryId: z.string().min(1),
  townshipId: z.string().min(1),
  title: z.string().trim().min(10, 'Give the listing a descriptive title').max(160),
  description: z
    .string()
    .trim()
    .min(30, 'Describe the property in at least 30 characters')
    .max(5000),
  addressLine: z.string().trim().max(240).optional(),
  hideExactAddress: z.boolean().default(false),

  priceAmount: priceString,
  currency: z.enum(['MMK', 'USD']).default('MMK'),
  priceIsNegotiable: z.boolean().default(false),
  priceOnRequest: z.boolean().default(false),

  rentPeriod: z.enum(['MONTHLY', 'YEARLY']).optional(),
  depositAmount: priceString.optional(),
  advanceMonths: z.number().int().min(0).max(36).optional(),
  minLeaseMonths: z.number().int().min(0).max(120).optional(),
  utilitiesIncluded: z.boolean().optional(),

  isInstallmentAvailable: z.boolean().default(false),
  installmentNote: z.string().trim().max(500).optional(),

  bedrooms: z.number().int().min(0).max(50).optional(),
  bathrooms: z.number().int().min(0).max(50).optional(),
  floorNumber: z.number().int().min(-5).max(200).optional(),
  totalFloors: z.number().int().min(1).max(200).optional(),
  floorAreaSqft: z.number().int().min(1).max(2_000_000).optional(),
  furnishing: z.enum(['NONE', 'PARTIAL', 'FULL']).optional(),
  hasLift: z.boolean().optional(),
  hasParking: z.boolean().optional(),
  buildYear: z.number().int().min(1900).max(2100).optional(),
  facing: z.string().trim().max(40).optional(),

  landWidthFt: z.number().int().min(1).max(100_000).optional(),
  landLengthFt: z.number().int().min(1).max(100_000).optional(),
  landAreaSqft: z.number().int().min(1).optional(),
  landAreaAcre: z.number().min(0).max(100_000).optional(),
  roadWidthFt: z.number().int().min(0).max(500).optional(),
  isCornerPlot: z.boolean().optional(),
  landGrade: z.enum(['GRANT', 'FREEHOLD', 'LA_NA_39', 'OTHER']).optional(),

  powerPhase: z.enum(['SINGLE', 'THREE']).optional(),
  ceilingHeightFt: z.number().int().min(1).max(200).optional(),

  contactName: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().min(6).max(30),
  contactViber: z.string().trim().max(30).optional(),

  amenityIds: z.array(z.string()).max(50).default([]),
  /** Agents may list on behalf of an owner account. */
  ownerId: z.string().optional(),
};

/**
 * A RENT listing needs rent terms; a SALE listing must not carry them. Without
 * this, a sale listing could silently keep a stale deposit from an earlier edit.
 */
export const createListingSchema = z.object(baseListingFields).superRefine((value, ctx) => {
  if (value.dealType === 'RENT' && value.rentPeriod == null) {
    ctx.addIssue({
      code: 'custom',
      path: ['rentPeriod'],
      message: 'Rental listings need a rent period',
    });
  }
  if (value.dealType === 'SALE') {
    const rentOnly = ['rentPeriod', 'depositAmount', 'advanceMonths', 'minLeaseMonths'] as const;
    for (const field of rentOnly) {
      if (value[field] != null) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: 'Only rental listings can set rent terms',
        });
      }
    }
  }
});

export const updateListingSchema = z
  .object(baseListingFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const listingStatusSchema = z.object({
  status: z.enum(['SOLD', 'RENTED', 'ARCHIVED', 'DRAFT', 'PENDING_REVIEW']),
});

export const moderateSchema = z.object({
  reason: z.string().trim().min(5, 'Give the seller a reason').max(500).optional(),
});

export const idParamSchema = z.object({ id: z.string().min(1) });

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
