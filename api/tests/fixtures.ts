import type { Express } from 'express';
import request from 'supertest';
import { prisma } from '../src/db/prisma.js';
import { hashPassword } from '../src/lib/password.js';
import type { Role } from '../src/generated/prisma/enums.js';

export const PASSWORD = 'Password123!';

/** Truncates every table so each suite starts from a known state. */
export async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.report.deleteMany(),
    prisma.savedSearch.deleteMany(),
    prisma.savedListing.deleteMany(),
    prisma.enquiry.deleteMany(),
    prisma.listingEvent.deleteMany(),
    prisma.listingAmenity.deleteMany(),
    prisma.media.deleteMany(),
    prisma.listing.deleteMany(),
    prisma.otpCode.deleteMany(),
    prisma.session.deleteMany(),
    prisma.agentProfile.deleteMany(),
    prisma.userRoleAssignment.deleteMany(),
    prisma.user.deleteMany(),
    prisma.amenity.deleteMany(),
    prisma.category.deleteMany(),
    prisma.township.deleteMany(),
    prisma.city.deleteMany(),
    prisma.region.deleteMany(),
  ]);
}

export interface Taxonomy {
  regionId: string;
  cityId: string;
  bahanId: string;
  yankinId: string;
  condoId: string;
  landId: string;
  liftAmenityId: string;
}

export async function seedTaxonomy(): Promise<Taxonomy> {
  const region = await prisma.region.create({
    data: { slug: 'yangon-region', nameEn: 'Yangon Region', nameMy: 'ရန်ကုန်' },
  });
  const city = await prisma.city.create({
    data: { regionId: region.id, slug: 'yangon', nameEn: 'Yangon', nameMy: 'ရန်ကုန်' },
  });
  const bahan = await prisma.township.create({
    data: { cityId: city.id, slug: 'bahan', nameEn: 'Bahan', nameMy: 'ဗဟန်း' },
  });
  const yankin = await prisma.township.create({
    data: { cityId: city.id, slug: 'yankin', nameEn: 'Yankin', nameMy: 'ရန်ကင်း' },
  });

  const residential = await prisma.category.create({
    data: {
      slug: 'residential',
      nameEn: 'Residential',
      nameMy: 'နေထိုင်ရန်',
      fieldSet: 'BUILDING',
    },
  });
  const condo = await prisma.category.create({
    data: {
      parentId: residential.id,
      slug: 'condo',
      nameEn: 'Condominium',
      nameMy: 'ကွန်ဒို',
      fieldSet: 'BUILDING',
    },
  });
  const landParent = await prisma.category.create({
    data: { slug: 'land', nameEn: 'Land', nameMy: 'မြေကွက်', fieldSet: 'LAND' },
  });
  const land = await prisma.category.create({
    data: {
      parentId: landParent.id,
      slug: 'residential-land',
      nameEn: 'Residential land',
      nameMy: 'မြေ',
      fieldSet: 'LAND',
    },
  });
  const lift = await prisma.amenity.create({
    data: { slug: 'lift', nameEn: 'Lift', nameMy: 'ဓာတ်လှေကား', appliesTo: 'BUILDING' },
  });

  return {
    regionId: region.id,
    cityId: city.id,
    bahanId: bahan.id,
    yankinId: yankin.id,
    condoId: condo.id,
    landId: land.id,
    liftAmenityId: lift.id,
  };
}

export async function createUser(
  email: string,
  roles: Role[],
  overrides: { name?: string; phone?: string; isActive?: boolean } = {},
) {
  return prisma.user.create({
    data: {
      email,
      name: overrides.name ?? email.split('@')[0]!,
      phone: overrides.phone ?? null,
      passwordHash: await hashPassword(PASSWORD),
      isVerified: true,
      isActive: overrides.isActive ?? true,
      roles: { create: roles.map((role) => ({ role })) },
      ...(roles.includes('AGENT') ? { agentProfile: { create: {} } } : {}),
    },
  });
}

export async function tokenFor(app: Express, email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('x-client', 'mobile')
    .send({ identifier: email, password: PASSWORD })
    .expect(200);
  return res.body.accessToken as string;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A minimal valid listing body; override per test. */
export function listingBody(t: Taxonomy, over: Record<string, unknown> = {}) {
  return {
    dealType: 'SALE',
    categoryId: t.condoId,
    townshipId: t.bahanId,
    title: 'A pleasant condominium in Bahan township',
    description: 'A description that comfortably clears the thirty character minimum length.',
    priceAmount: '450000000',
    contactName: 'Test Contact',
    contactPhone: '09123456789',
    ...over,
  };
}

/** Creates a listing directly in the database, bypassing the API. */
export async function createListing(
  t: Taxonomy,
  ownerId: string,
  over: Record<string, unknown> = {},
) {
  const title = (over['title'] as string) ?? 'A pleasant condominium in Bahan township';
  return prisma.listing.create({
    data: {
      publicRef: `YGN-2026-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')}`,
      ownerId,
      createdById: ownerId,
      dealType: 'SALE',
      status: 'PUBLISHED',
      categoryId: t.condoId,
      townshipId: t.bahanId,
      title,
      titleNormalized: title.toLowerCase(),
      description: 'A description that comfortably clears the thirty character minimum length.',
      priceAmount: 450_000_000n,
      contactName: 'Test Contact',
      contactPhone: '09123456789',
      publishedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      ...over,
    },
  });
}
