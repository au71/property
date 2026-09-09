import { rm } from 'node:fs/promises';
import { prisma, applySqlitePragmas } from '../../src/db/prisma.js';
import { hashPassword } from '../../src/lib/password.js';
import { config } from '../../src/config/index.js';
import { deriveLandAreaSqft } from '../../src/domain/area.js';
import { makeRng, type Rng } from './rng.js';
import { generateListingImage } from './images.js';
import { regions } from './data/locations.js';
import { amenities as amenitySeeds, categories } from './data/categories.js';
import { RENT_BAND_MMK, SALE_BAND_LAKH, TOWNSHIP_TIER } from './data/pricing.js';
import * as content from './data/content.js';
import type { DealType, ListingStatus, Prisma } from '../../src/generated/prisma/client.js';

const SEED = 20260909;
const LISTING_COUNT = 300;
/**
 * The daily quota looks back 24 hours. Dating every seeded listing at least two
 * days ago keeps demo accounts out of that window, so `owner1@property.test` can
 * post the moment you sign in as them.
 */
const SEED_MIN_AGE_DAYS = 2;
const DEMO_PASSWORD = 'Password123!';
const LAKH = 100_000n;

const rng = makeRng(SEED);

async function wipe(): Promise<void> {
  // Order matters: children before parents, since SQLite enforces the FKs.
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
  await rm(`${config.storage.localDir}/listings`, { recursive: true, force: true });
}

async function seedTaxonomy() {
  let regionOrder = 0;
  for (const region of regions) {
    const createdRegion = await prisma.region.create({
      data: {
        slug: region.slug,
        nameEn: region.nameEn,
        nameMy: region.nameMy,
        isActive: region.isActive,
        sortOrder: regionOrder++,
      },
    });
    let cityOrder = 0;
    for (const city of region.cities) {
      const createdCity = await prisma.city.create({
        data: {
          regionId: createdRegion.id,
          slug: city.slug,
          nameEn: city.nameEn,
          nameMy: city.nameMy,
          isActive: region.isActive,
          sortOrder: cityOrder++,
        },
      });
      await prisma.township.createMany({
        data: city.townships.map((t, i) => ({
          cityId: createdCity.id,
          slug: t.slug,
          nameEn: t.nameEn,
          nameMy: t.nameMy,
          isActive: region.isActive,
          sortOrder: i,
        })),
      });
    }
  }

  let categoryOrder = 0;
  for (const parent of categories) {
    const createdParent = await prisma.category.create({
      data: {
        slug: parent.slug,
        nameEn: parent.nameEn,
        nameMy: parent.nameMy,
        fieldSet: parent.fieldSet,
        iconKey: parent.iconKey,
        sortOrder: categoryOrder++,
      },
    });
    await prisma.category.createMany({
      data: parent.children.map((child, i) => ({
        parentId: createdParent.id,
        slug: child.slug,
        nameEn: child.nameEn,
        nameMy: child.nameMy,
        fieldSet: child.fieldSet,
        iconKey: child.iconKey,
        sortOrder: i,
      })),
    });
  }

  await prisma.amenity.createMany({
    data: amenitySeeds.map((a, i) => ({
      slug: a.slug,
      nameEn: a.nameEn,
      nameMy: a.nameMy,
      appliesTo: a.appliesTo,
      sortOrder: i,
    })),
  });
}

function phoneFor(index: number): string {
  return `+959${String(700000000 + index * 137).slice(0, 9)}`;
}

async function seedUsers() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  let phoneIndex = 0;

  const admin = await prisma.user.create({
    data: {
      name: 'Portal Administrator',
      email: 'admin@property.test',
      phone: phoneFor(phoneIndex++),
      passwordHash,
      isVerified: true,
      preferredLang: 'en',
      roles: { create: [{ role: 'ADMIN' }, { role: 'STAFF' }, { role: 'SEEKER' }] },
    },
  });

  const staff = await prisma.user.create({
    data: {
      name: 'Moderation Staff',
      email: 'staff@property.test',
      phone: phoneFor(phoneIndex++),
      passwordHash,
      isVerified: true,
      preferredLang: 'en',
      roles: { create: [{ role: 'STAFF' }, { role: 'SEEKER' }] },
    },
  });

  const agents = [];
  for (let i = 0; i < content.AGENT_NAMES.length; i += 1) {
    const isVerifiedAgent = i < 2;
    agents.push(
      await prisma.user.create({
        data: {
          name: content.AGENT_NAMES[i]!,
          email: `agent${i + 1}@property.test`,
          phone: phoneFor(phoneIndex++),
          passwordHash,
          isVerified: true,
          roles: { create: [{ role: 'AGENT' }, { role: 'SEEKER' }] },
          agentProfile: {
            create: {
              agencyName: content.AGENCY_NAMES[i % content.AGENCY_NAMES.length]!,
              licenseNo: `MM-RE-${2200 + i}`,
              bio: 'Local property specialist working across Yangon and Mandalay.',
              isVerifiedAgent,
              verifiedAt: isVerifiedAgent ? new Date() : null,
              serviceAreas: ['yangon', 'mandalay'],
            },
          },
        },
      }),
    );
  }

  const owners = [];
  for (let i = 0; i < content.OWNER_NAMES.length; i += 1) {
    owners.push(
      await prisma.user.create({
        data: {
          name: content.OWNER_NAMES[i]!,
          email: `owner${i + 1}@property.test`,
          phone: phoneFor(phoneIndex++),
          passwordHash,
          isVerified: rng.bool(0.8),
          roles: { create: [{ role: 'OWNER' }, { role: 'SEEKER' }] },
        },
      }),
    );
  }

  const seekers = [];
  for (let i = 0; i < content.SEEKER_NAMES.length; i += 1) {
    seekers.push(
      await prisma.user.create({
        data: {
          name: content.SEEKER_NAMES[i]!,
          email: `buyer${i + 1}@property.test`,
          phone: phoneFor(phoneIndex++),
          passwordHash,
          isVerified: rng.bool(0.6),
          roles: { create: [{ role: 'SEEKER' }] },
        },
      }),
    );
  }

  return { admin, staff, agents, owners, seekers };
}

interface TownshipRow {
  id: string;
  slug: string;
  nameEn: string;
  cityId: string;
  citySlug: string;
}

function priceFor(dealType: DealType, categorySlug: string, townshipSlug: string, r: Rng): bigint {
  const tier = TOWNSHIP_TIER[townshipSlug] ?? 1;
  if (dealType === 'SALE') {
    const band = SALE_BAND_LAKH[categorySlug] ?? [1000, 5000];
    const lakh = Math.round(r.float(band[0], band[1]) * tier);
    // Sale prices are quoted in round lakh, so store a clean multiple.
    return BigInt(lakh) * LAKH;
  }
  const band = RENT_BAND_MMK[categorySlug] ?? [300_000, 1_500_000];
  const raw = r.float(band[0], band[1]) * tier;
  // Rents are quoted to the nearest 50,000 MMK.
  return BigInt(Math.round(raw / 50_000) * 50_000);
}

function buildingAttributes(categorySlug: string, r: Rng) {
  const bedrooms = categorySlug === 'room' ? 1 : r.int(1, 5);
  const floorArea = categorySlug === 'room' ? r.int(150, 400) : r.int(600, 600 + bedrooms * 500);
  const totalFloors = r.int(4, 14);
  return {
    bedrooms,
    bathrooms: Math.max(1, Math.min(bedrooms, r.int(1, 3))),
    floorNumber: r.int(1, totalFloors),
    totalFloors,
    floorAreaSqft: floorArea,
    furnishing: r.weighted({ NONE: 40, PARTIAL: 40, FULL: 20 }),
    hasLift: r.bool(0.55),
    hasParking: r.bool(0.5),
    buildYear: r.int(1998, 2025),
    facing: r.pick(content.FACINGS),
  } as const;
}

function landAttributes(categorySlug: string, r: Rng) {
  if (categorySlug === 'farmland') {
    const acres = Number(r.float(1, 40).toFixed(2));
    return {
      landAreaAcre: acres,
      landAreaSqft: Math.round(acres * 43_560),
      roadWidthFt: r.int(8, 30),
      isCornerPlot: r.bool(0.2),
      landGrade: r.weighted({ LA_NA_39: 60, GRANT: 15, FREEHOLD: 15, OTHER: 10 }),
    } as const;
  }
  const widthFt = r.pick([20, 25, 30, 40, 50, 60, 80, 100]);
  const lengthFt = r.pick([40, 50, 60, 70, 80, 100, 120]);
  return {
    landWidthFt: widthFt,
    landLengthFt: lengthFt,
    landAreaSqft: deriveLandAreaSqft(widthFt, lengthFt),
    roadWidthFt: r.pick([12, 15, 18, 20, 24, 30, 40]),
    isCornerPlot: r.bool(0.22),
    landGrade: r.weighted({ GRANT: 55, FREEHOLD: 25, LA_NA_39: 10, OTHER: 10 }),
  } as const;
}

function commercialAttributes(r: Rng) {
  const totalFloors = r.int(1, 10);
  return {
    floorAreaSqft: r.int(500, 12_000),
    floorNumber: r.int(1, totalFloors),
    totalFloors,
    hasLift: r.bool(0.4),
    hasParking: r.bool(0.6),
    powerPhase: r.weighted({ SINGLE: 45, THREE: 55 }),
    ceilingHeightFt: r.int(9, 22),
  } as const;
}

async function main(): Promise<void> {
  console.log('Seeding property portal sample data...');
  await applySqlitePragmas();
  await wipe();

  await seedTaxonomy();
  console.log('  taxonomy seeded');

  const users = await seedUsers();
  const listers = [...users.owners, ...users.agents];
  console.log(
    `  ${users.owners.length} owners, ${users.agents.length} agents, ${users.seekers.length} seekers, 2 staff`,
  );

  // Only active locations get listings; Naypyitaw is staged but not launched.
  const townships: TownshipRow[] = (
    await prisma.township.findMany({
      where: { isActive: true },
      select: {
        id: true,
        slug: true,
        nameEn: true,
        cityId: true,
        city: { select: { slug: true } },
      },
    })
  ).map((t) => ({
    id: t.id,
    slug: t.slug,
    nameEn: t.nameEn,
    cityId: t.cityId,
    citySlug: t.city.slug,
  }));

  const yangonTownships = townships.filter((t) => t.citySlug === 'yangon');
  const mandalayTownships = townships.filter((t) => t.citySlug === 'mandalay');

  const leafCategories = await prisma.category.findMany({
    where: { parentId: { not: null } },
    select: { id: true, slug: true, nameEn: true, fieldSet: true },
  });
  const allAmenities = await prisma.amenity.findMany({ select: { id: true, appliesTo: true } });

  const statusWeights: Record<ListingStatus, number> = {
    PUBLISHED: 70,
    PENDING_REVIEW: 10,
    DRAFT: 8,
    SOLD: 3,
    RENTED: 2,
    EXPIRED: 4,
    REJECTED: 3,
    SUSPENDED: 0,
    ARCHIVED: 0,
  };

  const now = Date.now();
  const publishedIds: string[] = [];
  let refCounter = 0;

  /**
   * The API allows five new listings per account per rolling 24 hours. Seeded
   * listings are historical — every one is dated at least SEED_MIN_AGE_DAYS ago
   * — so no demo account starts life unable to post.
   *
   * Listings are still spread across owners rather than piled onto a few, so the
   * dashboard looks like a real portal rather than one prolific seller.
   */
  const perOwner = new Map<string, number>();
  const OWNER_SPREAD_TARGET = Math.ceil(LISTING_COUNT / users.owners.length) + 2;
  const ownerWithRoom = (): (typeof users.owners)[number] => {
    const eligible = users.owners.filter((o) => (perOwner.get(o.id) ?? 0) < OWNER_SPREAD_TARGET);
    return rng.pick(eligible.length > 0 ? eligible : users.owners);
  };

  for (let i = 0; i < LISTING_COUNT; i += 1) {
    const inYangon = rng.bool(0.65);
    const township = rng.pick(inYangon ? yangonTownships : mandalayTownships);
    const category = rng.pick(leafCategories);
    const dealType: DealType = rng.bool(0.55) ? 'SALE' : 'RENT';
    const status = rng.weighted(statusWeights);
    const lister = rng.pick(listers);
    // Agents list on an owner's behalf; owners list for themselves.
    const isAgentListing = users.agents.some((a) => a.id === lister.id);
    const owner =
      isAgentListing || (perOwner.get(lister.id) ?? 0) >= OWNER_SPREAD_TARGET
        ? ownerWithRoom()
        : lister;
    perOwner.set(owner.id, (perOwner.get(owner.id) ?? 0) + 1);

    refCounter += 1;
    const cityCode = township.citySlug === 'yangon' ? 'YGN' : 'MDY';
    const publicRef = `${cityCode}-2026-${String(refCounter).padStart(6, '0')}`;

    const price = priceFor(dealType, category.slug, township.slug, rng);
    const street = rng.pick(content.STREET_NAMES);
    const title =
      dealType === 'SALE'
        ? `${category.nameEn} for sale in ${township.nameEn}`
        : `${category.nameEn} for rent in ${township.nameEn}`;

    const description = [
      `${rng.pick(content.CONDITION)} ${category.nameEn.toLowerCase()} in ${township.nameEn}, ${rng.pick(content.NEARBY)}.`,
      rng.pick(content.SELLING_POINT) + '.',
      rng.pick(content.SELLING_POINT) + '.',
      dealType === 'RENT'
        ? 'Please contact us to arrange a viewing. Serious enquiries only.'
        : 'Clear documents and ready to transfer. Viewing by appointment.',
    ].join('\n\n');

    const attributes =
      category.fieldSet === 'BUILDING'
        ? buildingAttributes(category.slug, rng)
        : category.fieldSet === 'LAND'
          ? landAttributes(category.slug, rng)
          : commercialAttributes(rng);

    const isPublic = status === 'PUBLISHED';
    const publishedAt =
      isPublic || status === 'SOLD' || status === 'RENTED' || status === 'EXPIRED'
        ? rng.pastDate(SEED_MIN_AGE_DAYS, 90)
        : null;
    const expiresAt =
      status === 'EXPIRED'
        ? rng.pastDate(1, 10)
        : publishedAt
          ? new Date(publishedAt.getTime() + 60 * 24 * 60 * 60 * 1000)
          : null;

    const isFeatured = isPublic && rng.bool(0.08);

    const rentFields =
      dealType === 'RENT'
        ? {
            rentPeriod: 'MONTHLY' as const,
            depositAmount: price * BigInt(rng.int(1, 2)),
            advanceMonths: rng.pick([3, 6, 6, 12]),
            minLeaseMonths: rng.pick([6, 12, 12, 24]),
            utilitiesIncluded: rng.bool(0.25),
          }
        : {
            isInstallmentAvailable: rng.bool(0.2),
          };

    const listing = await prisma.listing.create({
      data: {
        publicRef,
        ownerId: owner.id,
        createdById: lister.id,
        dealType,
        status,
        categoryId: category.id,
        townshipId: township.id,
        addressLine: `No. ${rng.int(1, 240)}, ${street}, ${township.nameEn}`,
        hideExactAddress: rng.bool(0.25),
        title,
        titleNormalized: title.toLowerCase(),
        description,
        priceAmount: price,
        currency: 'MMK',
        priceIsNegotiable: rng.bool(0.45),
        priceOnRequest: rng.bool(0.05),
        contactName: lister.name,
        contactPhone: lister.phone ?? '+959700000000',
        contactViber: rng.bool(0.6) ? (lister.phone ?? null) : null,
        isFeatured,
        featuredUntil: isFeatured ? new Date(now + 30 * 24 * 60 * 60 * 1000) : null,
        viewCount: isPublic ? rng.int(5, 2400) : rng.int(0, 20),
        publishedAt,
        expiresAt,
        rejectionReason: status === 'REJECTED' ? rng.pick(content.REJECTION_REASONS) : null,
        createdAt: publishedAt ?? rng.pastDate(SEED_MIN_AGE_DAYS, 60),
        ...attributes,
        ...rentFields,
      },
    });

    if (isPublic) publishedIds.push(listing.id);

    // Amenities relevant to this category, plus the universal ones.
    const candidates = allAmenities.filter(
      (a) => a.appliesTo === null || a.appliesTo === category.fieldSet,
    );
    const chosen = rng.sample(candidates, rng.int(3, 9));
    if (chosen.length > 0) {
      await prisma.listingAmenity.createMany({
        data: chosen.map((a) => ({ listingId: listing.id, amenityId: a.id })),
      });
    }

    // Images: drafts get fewer, published listings get a full gallery.
    const imageCount = status === 'DRAFT' ? rng.int(0, 3) : rng.int(3, 8);
    for (let n = 0; n < imageCount; n += 1) {
      const image = await generateListingImage(
        config.storage.localDir,
        publicRef,
        n,
        `${category.nameEn}`,
        `${township.nameEn} · ${publicRef}`,
      );
      await prisma.media.create({
        data: {
          listingId: listing.id,
          url: `${config.storage.publicBaseUrl}/media/${image.key}`,
          thumbUrl: `${config.storage.publicBaseUrl}/media/${image.thumbKey}`,
          width: image.width,
          height: image.height,
          bytes: image.bytes,
          sortOrder: n,
          isCover: n === 0,
        },
      });
    }

    // Audit trail matching the status the listing ended up in.
    const events: Prisma.ListingEventCreateManyInput[] = [
      { listingId: listing.id, actorId: lister.id, toStatus: 'DRAFT', note: 'Listing created' },
    ];
    if (status !== 'DRAFT') {
      events.push({
        listingId: listing.id,
        actorId: lister.id,
        fromStatus: 'DRAFT',
        toStatus: 'PENDING_REVIEW',
        note: 'Submitted for review',
      });
    }
    if (['PUBLISHED', 'SOLD', 'RENTED', 'EXPIRED'].includes(status)) {
      events.push({
        listingId: listing.id,
        actorId: users.staff.id,
        fromStatus: 'PENDING_REVIEW',
        toStatus: 'PUBLISHED',
        note: 'Approved',
      });
    }
    if (status === 'REJECTED') {
      events.push({
        listingId: listing.id,
        actorId: users.staff.id,
        fromStatus: 'PENDING_REVIEW',
        toStatus: 'REJECTED',
        note: listing.rejectionReason,
      });
    }
    if (status === 'SOLD' || status === 'RENTED' || status === 'EXPIRED') {
      events.push({
        listingId: listing.id,
        actorId: status === 'EXPIRED' ? null : lister.id,
        fromStatus: 'PUBLISHED',
        toStatus: status,
        note: status === 'EXPIRED' ? 'Expired automatically' : `Marked ${status.toLowerCase()}`,
      });
    }
    await prisma.listingEvent.createMany({ data: events });

    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${LISTING_COUNT} listings`);
  }

  console.log(
    `  ${LISTING_COUNT} listings seeded (${publishedIds.length} published, ` +
      `max ${Math.max(...perOwner.values())} per owner)`,
  );

  // Enquiries against published listings only — that is all a seeker can see.
  let enquiryCount = 0;
  for (let i = 0; i < 120; i += 1) {
    const listingId = rng.pick(publishedIds);
    const seeker = rng.bool(0.75) ? rng.pick(users.seekers) : null;
    await prisma.enquiry.create({
      data: {
        listingId,
        seekerId: seeker?.id ?? null,
        name: seeker?.name ?? rng.pick(content.SEEKER_NAMES),
        phone: seeker?.phone ?? phoneFor(900 + i),
        email: seeker?.email ?? null,
        message: rng.pick(content.ENQUIRY_MESSAGES),
        preferredContact: rng.weighted({ PHONE: 60, VIBER: 30, EMAIL: 10 }),
        status: rng.weighted({ NEW: 55, CONTACTED: 30, CLOSED: 12, SPAM: 3 }),
        createdAt: rng.pastDate(0, 45),
      },
    });
    enquiryCount += 1;
  }
  // Keep the denormalised counter honest.
  for (const listingId of new Set(publishedIds)) {
    const count = await prisma.enquiry.count({ where: { listingId } });
    if (count > 0) {
      await prisma.listing.update({ where: { id: listingId }, data: { enquiryCount: count } });
    }
  }
  console.log(`  ${enquiryCount} enquiries seeded`);

  for (const seeker of users.seekers) {
    const saved = rng.sample(publishedIds, rng.int(2, 12));
    await prisma.savedListing.createMany({
      data: saved.map((listingId) => ({ userId: seeker.id, listingId })),
    });
  }

  const searchNames = [
    'Condo in Bahan under 3000 lakh',
    'Family house in Mandalay',
    'Cheap rooms near downtown',
    'Land for investment',
    'Office space Yangon',
  ];
  for (let i = 0; i < 20; i += 1) {
    const seeker = rng.pick(users.seekers);
    await prisma.savedSearch.create({
      data: {
        userId: seeker.id,
        name: `${rng.pick(searchNames)} #${i + 1}`,
        queryJson: {
          dealType: rng.bool() ? 'SALE' : 'RENT',
          townshipIds: [],
          minPrice: null,
          maxPrice: null,
        },
        alertFrequency: rng.weighted({ NONE: 40, DAILY: 35, WEEKLY: 25 }),
      },
    });
  }

  for (let i = 0; i < 10; i += 1) {
    await prisma.report.create({
      data: {
        listingId: rng.pick(publishedIds),
        reporterId: rng.pick(users.seekers).id,
        reason: rng.pick(content.REPORT_REASONS),
        detail: 'Reported from the listing page.',
        status: rng.weighted({ OPEN: 60, REVIEWING: 20, ACTIONED: 10, DISMISSED: 10 }),
        createdAt: rng.pastDate(0, 30),
      },
    });
  }

  console.log('  saved listings, saved searches and reports seeded');
  console.log(`\nDone. Every demo account uses the password: ${DEMO_PASSWORD}`);
  console.log('  admin@property.test                ADMIN + STAFF');
  console.log('  staff@property.test                STAFF');
  console.log(
    `  agent1..${content.AGENT_NAMES.length}@property.test           AGENT (1 and 2 are verified)`,
  );
  console.log(`  owner1..${content.OWNER_NAMES.length}@property.test          OWNER`);
  console.log(`  buyer1..${content.SEEKER_NAMES.length}@property.test          SEEKER`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
