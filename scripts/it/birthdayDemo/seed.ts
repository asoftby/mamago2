import type { Prisma, PrismaClient } from '@prisma/client';
import { hashPassword } from '../../../src/lib/auth/crypto';
import { syncCityToTerritory } from '../../../src/server/territory/syncLegacyGeo';
import { DEMO_OFFERS, DEMO_PASSWORD, demoDates, demoId } from './catalog';
import { assertBirthdayDemoEnvironment } from './guard';

export const DEMO_USERS = [
  { key: 'parent', name: 'Демо Родитель', role: 'USER' },
  { key: 'adult', name: 'Демо Второй взрослый', role: 'USER' },
  { key: 'outsider', name: 'Демо Другая семья', role: 'USER' },
  ...[1, 2, 3].map(n => ({ key: 'owner-' + n, name: 'Демо Исполнитель ' + n, role: 'BUSINESS_OWNER' })),
] as const;
const userIds = DEMO_USERS.map(u => demoId(u.key));
const businessIds = [1, 2, 3].map(n => demoId('business-' + n));
const familyIds = ['family', 'other-family'].map(demoId);
const offerIds = DEMO_OFFERS.map(o => demoId(o.key));
const unitIdFor = (key: string) => demoId('unit-' + (key === 'package-all' ? 'venue-1' : key));
const unitIds = [...new Set(DEMO_OFFERS.map(o => unitIdFor(o.key)))];
const placeIds = [...[1, 2, 3].map(n => demoId('place-' + n)), demoId('place-other-city')];

async function assertFixtureOwnership(db: Prisma.TransactionClient) {
  const [users, businesses, offers, places] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } }),
    db.business.findMany({ where: { id: { in: businessIds } }, select: { id: true, ownerUserId: true } }),
    db.offer.findMany({ where: { id: { in: offerIds } }, select: { id: true, placeId: true } }),
    db.place.findMany({ where: { id: { in: placeIds } }, select: { id: true, ownerBusinessId: true } }),
  ]);
  if (users.some(u => !DEMO_USERS.some(expected => u.id === demoId(expected.key) && u.email === expected.key + '@birthday-demo.test')) ||
      businesses.some(b => ![1, 2, 3].some(n => b.id === demoId('business-' + n) && b.ownerUserId === demoId('owner-' + n))) ||
      offers.some(o => !DEMO_OFFERS.some(expected => o.id === demoId(expected.key) && o.placeId === demoId(expected.otherCity ? 'place-other-city' : 'place-' + expected.business))) ||
      places.some(p => p.ownerBusinessId !== demoId('business-' + (p.id === demoId('place-other-city') ? 3 : p.id.slice(-1))))) {
    throw new Error('BIRTHDAY_DEMO refused: fixed IDs conflict with foreign ownership');
  }
}

async function cities(db: Prisma.TransactionClient) {
  const country = await db.country.findFirst({ where: { isoCode: 'BY' } }) ??
    await db.country.create({ data: { id: demoId('country-by'), name: 'Беларусь', slug: 'by', isoCode: 'BY', isActive: true } });
  const result: Record<string, string> = {};
  for (const [slug, name] of [['minsk', 'Минск'], ['vitebsk', 'Витебск']]) {
    const city = await db.city.findFirst({ where: { slug, countryId: country.id } }) ??
      await db.city.create({ data: { id: demoId('city-' + slug), name, slug, countryId: country.id, isActive: true } });
    await syncCityToTerritory(db, city.id);
    result[slug] = city.id;
  }
  return result;
}

export async function seedBirthdayDemo(prisma: PrismaClient, now = new Date()) {
  assertBirthdayDemoEnvironment(process.env);
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const dates = demoDates(now);
  await prisma.$transaction(async db => {
    // Serialize this explicit offline command with its cleanup; never lock runtime catalogue reads.
    await db.$executeRaw`SELECT pg_advisory_xact_lock(724163701)`;
    await assertFixtureOwnership(db);
    const geo = await cities(db);
    for (const user of DEMO_USERS) {
      await db.user.upsert({ where: { id: demoId(user.key) }, update: {}, create: {
        id: demoId(user.key), email: user.key + '@birthday-demo.test', displayName: user.name,
        role: user.role === 'BUSINESS_OWNER' ? 'BUSINESS_OWNER' : 'USER', passwordHash, emailVerifiedAt: now,
      } });
    }
    for (const key of ['family', 'other-family']) {
      await db.family.upsert({ where: { id: demoId(key) }, update: {}, create: {
        id: demoId(key), name: key === 'family' ? 'Демо семья праздника' : 'Посторонняя демо семья', homeCityId: geo.minsk,
      } });
    }
    for (const [key, family, role] of [['parent', 'family', 'OWNER'], ['adult', 'family', 'ADULT'], ['outsider', 'other-family', 'OWNER']] as const) {
      await db.familyMembership.upsert({ where: { id: demoId('member-' + key) }, update: {}, create: {
        id: demoId('member-' + key), userId: demoId(key), familyId: demoId(family), role, historyAccess: 'ALL',
      } });
    }
    for (const [key, family, parent, years] of [['child', 'family', 'parent', 8], ['other-child', 'other-family', 'outsider', 6]] as const) {
      const birthDate = new Date(now); birthDate.setUTCFullYear(birthDate.getUTCFullYear() - years);
      await db.child.upsert({ where: { id: demoId(key) }, update: {}, create: {
        id: demoId(key), name: 'Тестовый ребёнок', familyId: demoId(family), parentId: demoId(parent), createdById: demoId(parent), birthDate, birthPrecision: 'DAY',
      } });
    }
    for (const n of [1, 2, 3]) {
      await db.business.upsert({ where: { id: demoId('business-' + n) }, update: {}, create: {
        id: demoId('business-' + n), ownerUserId: demoId('owner-' + n), name: 'Тестовый праздник ' + n,
        status: 'APPROVED', verificationStatus: 'APPROVED', operationalStatus: 'ACTIVE', isVerified: true,
      } });
      await db.businessMember.upsert({ where: { businessId_userId: { businessId: demoId('business-' + n), userId: demoId('owner-' + n) } }, update: {},
        create: { businessId: demoId('business-' + n), userId: demoId('owner-' + n), role: 'OWNER' } });
      await db.place.upsert({ where: { id: demoId('place-' + n) }, update: {}, create: {
        id: demoId('place-' + n), slug: demoId('studio-' + n), title: 'Тестовая студия ' + n, shortDesc: 'Изолированная тестовая площадка; не настоящий бизнес.',
        cityId: geo.minsk, displayAddress: ['Демо: Центральный район', 'Демо: Уручье', 'Демо: Заводской район'][n - 1], status: 'PUBLISHED', ownerBusinessId: demoId('business-' + n), createdByUserId: demoId('owner-' + n),
      } });
    }
    await db.place.upsert({ where: { id: demoId('place-other-city') }, update: {}, create: {
      id: demoId('place-other-city'), slug: demoId('studio-vitebsk'), title: 'Тестовая студия другого города', shortDesc: 'Проверка ограничения города.',
      cityId: geo.vitebsk, status: 'PUBLISHED', ownerBusinessId: demoId('business-3'), createdByUserId: demoId('owner-3'),
    } });
    for (const offer of DEMO_OFFERS) {
      const id = demoId(offer.key);
      await db.offer.upsert({ where: { id }, update: {}, create: {
        id, slug: id, title: offer.title + ' [ДЕМО]', placeId: demoId(offer.otherCity ? 'place-other-city' : 'place-' + offer.business),
        kind: 'SERVICE', productType: offer.productType, category: offer.category, currency: 'BYN',
        status: offer.hidden ? 'DRAFT' : 'PUBLISHED', publishedAt: offer.hidden ? null : now, priceFrom: offer.price,
        priceMode: offer.priceMode, partyLocationType: offer.location, ageMinMonths: offer.ageMin ?? 36, ageMaxMonths: 168,
        minChildren: offer.minChildren ?? 3, maxChildren: offer.maxChildren ?? 20, bookingMode: 'REQUEST_ONLY',
        details: { prepaymentTerms: 'Тест: 20% только после подтверждения', cancellationTerms: 'Тест: отмена за 7 дней', testFixture: 'birthday-demo-v1' },
      } });
      await db.offerPlacement.upsert({ where: { offerId_key: { offerId: id, key: 'BIRTHDAY' } }, update: {}, create: { offerId: id, key: 'BIRTHDAY', status: 'APPROVED' } });
      for (const [position, c] of (offer.components ?? []).entries()) {
        await db.packageComponent.upsert({ where: { id: demoId(offer.key + '-' + c.key) }, update: {}, create: {
          id: demoId(offer.key + '-' + c.key), packageId: id, category: c.category, title: c.title, position,
          removalPolicy: c.removalPolicy, removalCreditByn: c.removalCreditByn, isOptional: c.isOptional ?? false,
          archivedAt: c.archived ? now : null,
        } });
      }
      const unitId = unitIdFor(offer.key);
      await db.bookingUnit.upsert({ where: { id: unitId }, update: {}, create: {
        id: unitId, businessId: demoId('business-' + offer.business), placeId: demoId(offer.otherCity ? 'place-other-city' : 'place-' + offer.business),
        name: 'Тестовый ресурс: ' + offer.title, capacity: offer.maxChildren ?? 30, timezone: 'Europe/Minsk',
        status: offer.key === 'show-3' ? 'INACTIVE' : 'ACTIVE',
        rules: { create: Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, startMinutes: 540, endMinutes: 1260 })) },
      } });
      await db.bookingUnitOffer.upsert({ where: { bookingUnitId_offerId: { bookingUnitId: unitId, offerId: id } }, update: {}, create: { bookingUnitId: unitId, offerId: id } });
    }
    // The all-in package and venue-1 have ONE shared resource; no independent package resource.
    await db.calendarBlock.upsert({ where: { id: demoId('occupied-slot') },
      update: { blockStart: new Date(dates.occupiedFrom), blockEnd: new Date(dates.occupiedTo) }, create: {
        id: demoId('occupied-slot'), bookingUnitId: demoId('unit-venue-1'), blockStart: new Date(dates.occupiedFrom), blockEnd: new Date(dates.occupiedTo), note: 'Демо: занятый слот 12:00–14:00',
      } });
  }, { timeout: 60000 });
  return { ...dates, offers: DEMO_OFFERS.length, visibleInMinsk: 35, password: DEMO_PASSWORD,
    users: DEMO_USERS.map(u => ({ id: demoId(u.key), email: u.key + '@birthday-demo.test' })) };
}

/** Refuse cleanup if the fixture has acquired consumers outside its explicit synthetic accounts. */
export async function cleanupBirthdayDemo(prisma: PrismaClient) {
  assertBirthdayDemoEnvironment(process.env);
  return prisma.$transaction(async db => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(724163701)`;
    await assertFixtureOwnership(db);
    const foreign = await Promise.all([
      db.offer.count({ where: { placeId: { in: placeIds }, id: { notIn: offerIds } } }),
      db.bookingUnit.count({ where: { businessId: { in: businessIds }, id: { notIn: unitIds } } }),
      db.planItem.count({ where: { familyId: { in: familyIds }, userId: { notIn: userIds } } }),
      db.child.count({ where: { familyId: { in: familyIds }, parentId: { notIn: userIds } } }),
      db.bookingRequest.count({ where: { userId: { in: userIds }, businessId: { notIn: businessIds } } }),
      db.placeIdea.count({ where: { placeId: { in: placeIds }, userId: { notIn: userIds } } }),
      db.planItem.count({ where: { OR: [{ placeId: { in: placeIds } }, { venuePlaceId: { in: placeIds } }], userId: { notIn: userIds } } }),
      db.directThread.count({ where: { businessId: { in: businessIds }, customerUserId: { notIn: userIds } } }),
      db.activity.count({ where: { placeId: { in: placeIds } } }),
      db.articleLinkedItem.count({ where: { offerId: { in: offerIds } } }),
      db.place.count({ where: { parentPlaceId: { in: placeIds }, id: { notIn: placeIds } } }),
      db.partyOrderItem.count({ where: { offerId: { in: offerIds }, partyOrder: { ownerUserId: { notIn: userIds } } } }),
      db.bookingRequest.count({ where: { businessId: { in: businessIds }, OR: [{ userId: null }, { userId: { notIn: userIds } }] } }),
      db.planItem.count({ where: { offerId: { in: offerIds }, userId: { notIn: userIds } } }),
      db.offerIdea.count({ where: { offerId: { in: offerIds }, userId: { notIn: userIds } } }),
      db.packageComponent.count({ where: { refOfferId: { in: offerIds }, packageId: { notIn: offerIds } } }),
      db.familyMembership.count({ where: { OR: [
        { familyId: { in: familyIds }, userId: { notIn: userIds } }, { userId: { in: userIds }, familyId: { notIn: familyIds } },
      ] } }),
    ]);
    if (foreign.some(Boolean)) throw new Error('BIRTHDAY_DEMO cleanup refused: foreign consumers exist; remove their references explicitly');
    await db.partyOrder.deleteMany({ where: { ownerUserId: { in: userIds } } });
    await db.bookingRequest.deleteMany({ where: { businessId: { in: businessIds }, userId: { in: userIds } } });
    await db.family.deleteMany({ where: { id: { in: familyIds } } });
    await db.packageComponent.deleteMany({ where: { packageId: { in: offerIds } } });
    await db.offer.deleteMany({ where: { id: { in: offerIds } } });
    await db.bookingUnit.deleteMany({ where: { id: { in: unitIds } } });
    await db.place.deleteMany({ where: { id: { in: placeIds } } });
    await db.business.deleteMany({ where: { id: { in: businessIds } } });
    return db.user.deleteMany({ where: { id: { in: userIds }, email: { endsWith: '@birthday-demo.test' } } });
  }, { timeout: 60000 });
}
