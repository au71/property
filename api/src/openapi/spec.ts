import { z } from 'zod';
import {
  createListingSchema,
  listingStatusSchema,
  searchQuerySchema,
  updateListingSchema,
} from '../modules/listings/schema.js';
import {
  loginSchema,
  otpRequestSchema,
  otpVerifySchema,
  registerSchema,
} from '../modules/auth/schema.js';

/**
 * The OpenAPI document is generated from the same Zod schemas the API validates
 * with, so the contract cannot drift from the implementation the way a
 * hand-written spec does.
 */

type JsonSchema = Record<string, unknown>;

const toSchema = (schema: z.ZodType): JsonSchema =>
  z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input', unrepresentable: 'any' });

const ERROR_SCHEMA: JsonSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message', 'requestId'],
      properties: {
        code: {
          type: 'string',
          enum: [
            'VALIDATION_ERROR',
            'UNAUTHENTICATED',
            'FORBIDDEN',
            'NOT_FOUND',
            'CONFLICT',
            'PAYLOAD_TOO_LARGE',
            'RATE_LIMITED',
            'INTERNAL',
          ],
        },
        message: { type: 'string' },
        details: {},
        requestId: { type: 'string' },
      },
    },
  },
};

const PRICE_SCHEMA: JsonSchema = {
  type: 'object',
  required: ['amount', 'currency', 'lakhLabel', 'isNegotiable', 'onRequest'],
  properties: {
    // Decimal string, not a number: a MMK sale price can exceed the range where
    // a JSON number is safe to do arithmetic on.
    amount: { type: ['string', 'null'], pattern: '^\\d+$' },
    currency: { type: 'string', enum: ['MMK', 'USD'] },
    lakhLabel: { type: ['string', 'null'] },
    isNegotiable: { type: 'boolean' },
    onRequest: { type: 'boolean' },
    rentPeriod: { type: ['string', 'null'], enum: ['MONTHLY', 'YEARLY', null] },
    // Rental terms, present on RENT listings only.
    depositAmount: { type: ['string', 'null'], pattern: '^\\d+$' },
    depositLakhLabel: { type: ['string', 'null'] },
    advanceMonths: { type: ['integer', 'null'] },
    minLeaseMonths: { type: ['integer', 'null'] },
    utilitiesIncluded: { type: ['boolean', 'null'] },
    // Sale terms, present on SALE listings only.
    isInstallmentAvailable: { type: 'boolean' },
    installmentNote: { type: ['string', 'null'] },
  },
};

const TOWNSHIP: JsonSchema = {
  type: 'object',
  required: ['id', 'slug', 'nameEn', 'nameMy'],
  properties: {
    id: { type: 'string' },
    slug: { type: 'string' },
    nameEn: { type: 'string' },
    nameMy: { type: 'string' },
    // Listings always come back with the township's city expanded, so a card
    // can say "Bahan, Yangon" without a second request.
    city: {
      type: 'object',
      required: ['id', 'slug', 'nameEn', 'nameMy'],
      properties: {
        id: { type: 'string' },
        slug: { type: 'string' },
        nameEn: { type: 'string' },
        nameMy: { type: 'string' },
      },
    },
  },
};

const NAMED: JsonSchema = {
  type: 'object',
  // Marked required so generated clients get non-optional fields; every
  // taxonomy row in the database has all four.
  required: ['id', 'slug', 'nameEn', 'nameMy'],
  properties: {
    id: { type: 'string' },
    slug: { type: 'string' },
    nameEn: { type: 'string' },
    nameMy: { type: 'string' },
  },
};

const LISTING_SUMMARY: JsonSchema = {
  type: 'object',
  required: ['id', 'publicRef', 'dealType', 'status', 'title', 'price', 'isFeatured'],
  properties: {
    id: { type: 'string' },
    publicRef: { type: 'string' },
    dealType: { type: 'string', enum: ['SALE', 'RENT'] },
    status: { type: 'string' },
    title: { type: 'string' },
    price: PRICE_SCHEMA,
    category: NAMED,
    township: TOWNSHIP,
    coverImage: {
      type: ['object', 'null'],
      properties: { url: { type: 'string' }, thumbUrl: { type: 'string' } },
    },
    imageCount: { type: 'integer' },
    isFeatured: { type: 'boolean' },
    publishedAt: { type: ['string', 'null'], format: 'date-time' },
    viewCount: { type: 'integer' },
    bedrooms: { type: 'integer' },
    bathrooms: { type: 'integer' },
    floorAreaSqft: { type: 'integer' },
    landAreaSqft: { type: 'integer' },
    rejectionReason: { type: ['string', 'null'] },
  },
};

const LISTING_DETAIL: JsonSchema = {
  type: 'object',
  required: [
    ...(LISTING_SUMMARY['required'] as string[]),
    'description',
    'addressHidden',
    'attributes',
    'amenities',
    'media',
    'contact',
  ],
  properties: {
    ...(LISTING_SUMMARY['properties'] as JsonSchema),
    description: { type: 'string' },
    address: { type: ['string', 'null'] },
    addressHidden: { type: 'boolean' },
    attributes: { type: 'object', additionalProperties: true },
    amenities: { type: 'array', items: NAMED },
    media: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          url: { type: 'string' },
          thumbUrl: { type: 'string' },
          width: { type: 'integer' },
          height: { type: 'integer' },
          isCover: { type: 'boolean' },
        },
      },
    },
    contact: {
      type: 'object',
      description:
        'For a public viewer this is the contact name only — fetch the number from ' +
        'GET /listings/{id}/contact when they ask for it. The listing\u2019s own account ' +
        'and staff additionally get phone and viber, so an edit form can prefill them.',
      required: ['name', 'hasPhone', 'hasViber'],
      properties: {
        name: { type: 'string' },
        hasPhone: { type: 'boolean' },
        hasViber: { type: 'boolean' },
        phone: { type: 'string' },
        viber: { type: ['string', 'null'] },
      },
    },
    enquiryCount: { type: 'integer' },
    // Present only for the listing's own account and for staff. Absent from
    // every public response — these are a private individual's details.
    propertyOwner: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        phone: { type: ['string', 'null'] },
        note: { type: ['string', 'null'] },
      },
    },
    expiresAt: { type: ['string', 'null'], format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    rejectionReason: { type: ['string', 'null'] },
    owner: {
      type: ['object', 'null'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        avatarUrl: { type: ['string', 'null'] },
        agentProfile: {
          type: ['object', 'null'],
          properties: {
            agencyName: { type: ['string', 'null'] },
            isVerifiedAgent: { type: 'boolean' },
          },
        },
      },
    },
  },
};

const AUTH_RESULT: JsonSchema = {
  type: 'object',
  required: ['accessToken', 'user'],
  properties: {
    accessToken: { type: 'string' },
    // Present only for X-Client: mobile; web clients get an httpOnly cookie.
    refreshToken: { type: 'string' },
    user: {
      type: 'object',
      required: ['id', 'name', 'roles', 'preferredLang', 'isVerified'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: ['string', 'null'] },
        phone: { type: ['string', 'null'] },
        roles: { type: 'array', items: { type: 'string' } },
        preferredLang: { type: 'string' },
        isVerified: { type: 'boolean' },
      },
    },
  },
};

/** Turns a Zod object into OpenAPI query parameters. */
function queryParams(schema: z.ZodType): JsonSchema[] {
  const json = toSchema(schema);
  const properties = (json['properties'] ?? {}) as Record<string, JsonSchema>;
  const required = (json['required'] ?? []) as string[];
  return Object.entries(properties).map(([name, prop]) => ({
    name,
    in: 'query',
    required: required.includes(name),
    schema: prop,
    ...(prop['description'] ? { description: prop['description'] } : {}),
  }));
}

const pathParam = (name: string, description: string): JsonSchema => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description,
});

const json = (schema: JsonSchema) => ({ 'application/json': { schema } });

const errors = (...codes: Array<'400' | '401' | '403' | '404' | '409' | '429'>) =>
  Object.fromEntries(
    codes.map((code) => [code, { description: 'Error', content: json(ERROR_SCHEMA) }]),
  );

const listEnvelope = (items: JsonSchema): JsonSchema => ({
  type: 'object',
  properties: { data: { type: 'array', items } },
});

const pagedEnvelope = (items: JsonSchema): JsonSchema => ({
  type: 'object',
  properties: {
    data: { type: 'array', items },
    page: {
      type: 'object',
      properties: {
        limit: { type: 'integer' },
        nextCursor: { type: ['string', 'null'] },
        total: { type: 'integer' },
      },
    },
    facets: { type: 'object', additionalProperties: true },
  },
});

export function buildOpenApiDocument(): JsonSchema {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Property Portal API',
      version: '1.0.0',
      description:
        'Buy, sell and rent property across Myanmar. Prices are decimal strings in the ' +
        'smallest currency unit (MMK has no subunit), because a kyat sale price can ' +
        'exceed the range where a JSON number stays exact.',
    },
    servers: [{ url: 'http://localhost:4000/api/v1', description: 'Local development' }],
    tags: [
      { name: 'auth' },
      { name: 'taxonomy' },
      { name: 'listings' },
      { name: 'media' },
      { name: 'enquiries' },
      { name: 'saved' },
      { name: 'admin' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: ERROR_SCHEMA,
        ListingSummary: LISTING_SUMMARY,
        ListingDetail: LISTING_DETAIL,
        AuthResult: AUTH_RESULT,
        Named: NAMED,
        Township: TOWNSHIP,
      },
    },
    paths: {
      '/auth/register': {
        post: {
          tags: ['auth'],
          summary: 'Create an account',
          requestBody: { required: true, content: json(toSchema(registerSchema)) },
          responses: {
            '201': { description: 'Created', content: json(AUTH_RESULT) },
            ...errors('400', '409'),
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['auth'],
          summary: 'Sign in with a password',
          requestBody: { required: true, content: json(toSchema(loginSchema)) },
          responses: {
            '200': { description: 'Signed in', content: json(AUTH_RESULT) },
            ...errors('400', '401', '429'),
          },
        },
      },
      '/auth/otp/request': {
        post: {
          tags: ['auth'],
          summary: 'Send a one-time code by SMS',
          description:
            'Always answers 202 whether or not the number is registered, so it cannot ' +
            'be used to discover which numbers have accounts.',
          requestBody: { required: true, content: json(toSchema(otpRequestSchema)) },
          responses: { '202': { description: 'Accepted' }, ...errors('400', '429') },
        },
      },
      '/auth/otp/verify': {
        post: {
          tags: ['auth'],
          summary: 'Exchange a one-time code for a session',
          requestBody: { required: true, content: json(toSchema(otpVerifySchema)) },
          responses: {
            '200': { description: 'Signed in', content: json(AUTH_RESULT) },
            ...errors('400', '429'),
          },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['auth'],
          summary: 'Rotate the refresh token',
          description:
            'Replaying an already-rotated token revokes every session in its family, ' +
            'on the assumption that the token leaked.',
          responses: {
            '200': { description: 'Rotated', content: json(AUTH_RESULT) },
            ...errors('400', '401'),
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['auth'],
          summary: 'End the session',
          responses: { '204': { description: 'Signed out' } },
        },
      },
      '/auth/me': {
        get: {
          tags: ['auth'],
          summary: 'The signed-in user',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'OK' }, ...errors('401') },
        },
      },

      '/categories': {
        get: {
          tags: ['taxonomy'],
          summary: 'Property categories',
          parameters: [
            { name: 'tree', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          ],
          responses: { '200': { description: 'OK', content: json(listEnvelope(NAMED)) } },
        },
      },
      '/locations': {
        get: {
          tags: ['taxonomy'],
          summary: 'Region / city / township hierarchy',
          responses: { '200': { description: 'OK' } },
        },
      },
      '/locations/regions': {
        get: {
          tags: ['taxonomy'],
          summary: 'Regions',
          responses: { '200': { description: 'OK', content: json(listEnvelope(NAMED)) } },
        },
      },
      '/locations/cities': {
        get: {
          tags: ['taxonomy'],
          summary: 'Cities',
          parameters: [{ name: 'regionId', in: 'query', schema: { type: 'string' } }],
          responses: { '200': { description: 'OK', content: json(listEnvelope(NAMED)) } },
        },
      },
      '/locations/townships': {
        get: {
          tags: ['taxonomy'],
          summary: 'Townships',
          parameters: [{ name: 'cityId', in: 'query', schema: { type: 'string' } }],
          responses: { '200': { description: 'OK', content: json(listEnvelope(NAMED)) } },
        },
      },
      '/amenities': {
        get: {
          tags: ['taxonomy'],
          summary: 'Amenities',
          responses: { '200': { description: 'OK', content: json(listEnvelope(NAMED)) } },
        },
      },

      '/listings': {
        get: {
          tags: ['listings'],
          summary: 'Search published listings',
          parameters: queryParams(searchQuerySchema),
          responses: {
            '200': { description: 'OK', content: json(pagedEnvelope(LISTING_SUMMARY)) },
            ...errors('400'),
          },
        },
        post: {
          tags: ['listings'],
          summary: 'Create a listing (starts as DRAFT)',
          description:
            'Limited to 5 per account per rolling 24 hours, counted against whoever ' +
            'creates the listing. An agent can list for an owner who has no account by ' +
            'supplying propertyOwnerName / propertyOwnerPhone instead of ownerId.',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: json(toSchema(createListingSchema)) },
          responses: {
            '201': { description: 'Created', content: json(LISTING_DETAIL) },
            ...errors('400', '401', '403', '409'),
          },
        },
      },
      '/listings/{id}': {
        parameters: [pathParam('id', 'Listing id or public reference, e.g. YGN-2026-000123')],
        get: {
          tags: ['listings'],
          summary: 'One listing',
          responses: {
            '200': { description: 'OK', content: json(LISTING_DETAIL) },
            ...errors('404'),
          },
        },
        patch: {
          tags: ['listings'],
          summary: 'Edit a listing',
          description: 'Editing a published listing returns it to PENDING_REVIEW.',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: json(toSchema(updateListingSchema)) },
          responses: {
            '200': { description: 'Updated', content: json(LISTING_DETAIL) },
            ...errors('400', '401', '403', '404'),
          },
        },
        delete: {
          tags: ['listings'],
          summary: 'Soft-delete a listing',
          security: [{ bearerAuth: [] }],
          responses: { '204': { description: 'Deleted' }, ...errors('401', '403', '404') },
        },
      },
      '/listings/{id}/similar': {
        parameters: [pathParam('id', 'Listing id or public reference')],
        get: {
          tags: ['listings'],
          summary: 'Comparable listings',
          responses: { '200': { description: 'OK', content: json(listEnvelope(LISTING_SUMMARY)) } },
        },
      },
      '/listings/{id}/contact': {
        parameters: [pathParam('id', 'Listing id or public reference')],
        get: {
          tags: ['listings'],
          summary: 'Reveal the seller’s contact details',
          description:
            'Kept out of the listing payload so the number is not in the page source. ' +
            'Rate limited to 20 per minute.',
          responses: {
            '200': {
              description: 'OK',
              content: json({
                type: 'object',
                required: ['name', 'phone'],
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  viber: { type: ['string', 'null'] },
                },
              }),
            },
            ...errors('404', '429'),
          },
        },
      },
      '/listings/{id}/view': {
        parameters: [pathParam('id', 'Listing id or public reference')],
        post: {
          tags: ['listings'],
          summary: 'Record a view',
          responses: { '204': { description: 'Counted' } },
        },
      },
      '/listings/{id}/submit': {
        parameters: [pathParam('id', 'Listing id')],
        post: {
          tags: ['listings'],
          summary: 'Submit for review',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Submitted', content: json(LISTING_DETAIL) },
            ...errors('400', '401', '403', '404'),
          },
        },
      },
      '/listings/{id}/renew': {
        parameters: [pathParam('id', 'Listing id')],
        post: {
          tags: ['listings'],
          summary: 'Extend the expiry',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Renewed' }, ...errors('400', '401', '403', '404') },
        },
      },
      '/listings/{id}/status': {
        parameters: [pathParam('id', 'Listing id')],
        post: {
          tags: ['listings'],
          summary: 'Mark sold, rented or archived',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: json(toSchema(listingStatusSchema)) },
          responses: { '200': { description: 'Updated' }, ...errors('400', '401', '403', '404') },
        },
      },
      '/listings/{id}/media': {
        parameters: [pathParam('id', 'Listing id')],
        post: {
          tags: ['media'],
          summary: 'Upload photos',
          description: 'multipart/form-data, field name "files". Max 15 per listing, 8 MB each.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    files: { type: 'array', items: { type: 'string', format: 'binary' } },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Uploaded' }, ...errors('400', '401', '403', '404') },
        },
      },
      '/listings/{id}/media/reorder': {
        parameters: [pathParam('id', 'Listing id')],
        patch: {
          tags: ['media'],
          summary: 'Reorder photos (first becomes the cover)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: json({
              type: 'object',
              required: ['orderedIds'],
              properties: { orderedIds: { type: 'array', items: { type: 'string' } } },
            }),
          },
          responses: { '200': { description: 'Reordered' }, ...errors('400', '401', '403') },
        },
      },
      '/media/{id}': {
        parameters: [pathParam('id', 'Media id')],
        delete: {
          tags: ['media'],
          summary: 'Delete a photo',
          security: [{ bearerAuth: [] }],
          responses: { '204': { description: 'Deleted' }, ...errors('401', '403', '404') },
        },
      },

      '/listings/{id}/enquiries': {
        parameters: [pathParam('id', 'Listing id or public reference')],
        post: {
          tags: ['enquiries'],
          summary: 'Send an enquiry',
          description: 'Open to anonymous visitors. Rate limited to 5 per hour per IP.',
          requestBody: {
            required: true,
            content: json({
              type: 'object',
              required: ['name', 'phone', 'message'],
              properties: {
                name: { type: 'string' },
                phone: { type: 'string' },
                email: { type: 'string', format: 'email' },
                message: { type: 'string', minLength: 10 },
                preferredContact: { type: 'string', enum: ['PHONE', 'VIBER', 'EMAIL'] },
              },
            }),
          },
          responses: { '201': { description: 'Sent' }, ...errors('400', '404', '429') },
        },
      },
      '/listings/{id}/report': {
        parameters: [pathParam('id', 'Listing id or public reference')],
        post: {
          tags: ['enquiries'],
          summary: 'Report a listing',
          security: [{ bearerAuth: [] }],
          responses: { '201': { description: 'Reported' }, ...errors('400', '401', '404') },
        },
      },
      '/enquiries/{id}': {
        parameters: [pathParam('id', 'Enquiry id')],
        patch: {
          tags: ['enquiries'],
          summary: 'Update an enquiry status',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Updated' }, ...errors('401', '403', '404') },
        },
      },

      '/me/listings': {
        get: {
          tags: ['listings'],
          summary: 'The caller’s own listings, with status counts and remaining quota',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'OK' }, ...errors('401') },
        },
      },
      '/me/enquiries/unread-count': {
        get: {
          tags: ['enquiries'],
          summary: 'Number of unanswered enquiries',
          description:
            'Enquiries are delivered in-app only — no email or SMS — so this drives the ' +
            'badge that tells a seller a new one has arrived.',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'OK',
              content: json({
                type: 'object',
                required: ['count'],
                properties: { count: { type: 'integer' } },
              }),
            },
            ...errors('401'),
          },
        },
      },
      '/me/enquiries/received': {
        get: {
          tags: ['enquiries'],
          summary: 'Enquiries about the caller’s listings',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'OK' }, ...errors('401') },
        },
      },
      '/me/enquiries/sent': {
        get: {
          tags: ['enquiries'],
          summary: 'Enquiries the caller has sent',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'OK' }, ...errors('401') },
        },
      },
      '/me/saved-listings': {
        get: {
          tags: ['saved'],
          summary: 'Saved listings',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'OK', content: json(listEnvelope(LISTING_SUMMARY)) },
            ...errors('401'),
          },
        },
        post: {
          tags: ['saved'],
          summary: 'Save a listing',
          security: [{ bearerAuth: [] }],
          responses: { '204': { description: 'Saved' }, ...errors('401', '404') },
        },
      },
      '/me/saved-listings/{listingId}': {
        parameters: [pathParam('listingId', 'Listing id')],
        delete: {
          tags: ['saved'],
          summary: 'Unsave a listing',
          security: [{ bearerAuth: [] }],
          responses: { '204': { description: 'Removed' }, ...errors('401') },
        },
      },
      '/me/saved-searches': {
        get: {
          tags: ['saved'],
          summary: 'Saved searches',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'OK' }, ...errors('401') },
        },
        post: {
          tags: ['saved'],
          summary: 'Save a search',
          security: [{ bearerAuth: [] }],
          responses: { '201': { description: 'Created' }, ...errors('400', '401') },
        },
      },

      '/admin/listings': {
        get: {
          tags: ['admin'],
          summary: 'Moderation queue',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', default: 'PENDING_REVIEW' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
            { name: 'cursor', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' }, ...errors('401', '403') },
        },
      },
      '/admin/listings/{id}/approve': {
        parameters: [pathParam('id', 'Listing id')],
        post: {
          tags: ['admin'],
          summary: 'Approve and publish',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Published' }, ...errors('400', '401', '403', '404') },
        },
      },
      '/admin/listings/{id}/reject': {
        parameters: [pathParam('id', 'Listing id')],
        post: {
          tags: ['admin'],
          summary: 'Reject with a reason',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Rejected' }, ...errors('400', '401', '403', '404') },
        },
      },
      '/admin/listings/{id}/suspend': {
        parameters: [pathParam('id', 'Listing id')],
        post: {
          tags: ['admin'],
          summary: 'Suspend a live listing',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Suspended' }, ...errors('400', '401', '403', '404') },
        },
      },
      '/admin/listings/{id}/feature': {
        parameters: [pathParam('id', 'Listing id')],
        post: {
          tags: ['admin'],
          summary: 'Feature a listing for a number of days',
          description:
            'Free and editorial: staff choose what to promote and no money changes hands. ' +
            'There is deliberately no self-service route.',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Featured' }, ...errors('401', '403', '404') },
        },
      },
      '/admin/reports': {
        get: {
          tags: ['admin'],
          summary: 'Reported listings',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'OK' }, ...errors('401', '403') },
        },
      },
      '/admin/users': {
        get: {
          tags: ['admin'],
          summary: 'User accounts',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'OK' }, ...errors('401', '403') },
        },
      },
      '/admin/users/{id}/roles': {
        parameters: [pathParam('id', 'User id')],
        patch: {
          tags: ['admin'],
          summary: 'Set a user’s roles (ADMIN only)',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Updated' }, ...errors('400', '401', '403', '404') },
        },
      },
      '/admin/users/{id}/status': {
        parameters: [pathParam('id', 'User id')],
        patch: {
          tags: ['admin'],
          summary: 'Activate or deactivate an account',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'Updated' }, ...errors('400', '401', '403', '404') },
        },
      },
      '/admin/stats': {
        get: {
          tags: ['admin'],
          summary: 'Portfolio statistics',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'OK' }, ...errors('401', '403') },
        },
      },
    },
  };
}
