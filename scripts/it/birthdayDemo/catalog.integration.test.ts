import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import appPrisma from '../../../src/lib/prisma';
import { getPublicBirthdayCatalog } from '../../../src/server/birthday/catalog.service';
import { createPartyDraft, readPartyOrder, updatePartyDraft } from '../../../src/server/birthday/partyDraft.service';
import { previewPartyOfferAvailability } from '../../../src/server/birthday/partyAvailabilityPreview.service';
import { matchesBirthdayRequirements } from '../../../src/features/birthday/builder/lib/realCatalog';
import { isAllowedBase } from '../../../src/features/birthday/builder/lib/catalogSelection';
import { assertBirthdayDemoEnvironment } from './guard';
import { DEMO_OFFERS, DEMO_PASSWORD, demoId, demoDates } from './catalog';
import { cleanupBirthdayDemo, seedBirthdayDemo } from './seed';
import { verifyPassword } from '../../../src/lib/auth/crypto';

assertBirthdayDemoEnvironment(process.env);
const prisma = new PrismaClient();
function estimatedMinimum(order: unknown) {
  assert.ok(order && typeof order === 'object' && 'estimate' in order);
  const estimate = order.estimate;
  assert.ok(estimate && typeof estimate === 'object' && 'minimumByn' in estimate);
  assert.equal(typeof estimate.minimumByn, 'number');
  return estimate.minimumByn;
}
async function main() {
  const now = new Date();
  const dates = demoDates(now);
  const sentinel = await prisma.user.create({ data: { email: 'demo-sentinel-' + Date.now() + '@it.test', role: 'USER' } });
  try {
    await seedBirthdayDemo(prisma, now);
    const before = await prisma.offer.count({ where: { id: { in: DEMO_OFFERS.map(o => demoId(o.key)) } } });
    await seedBirthdayDemo(prisma, now);
    assert.equal(await prisma.offer.count({ where: { id: { in: DEMO_OFFERS.map(o => demoId(o.key)) } } }), before);
    assert.equal(before, 37);
    const catalogue = (await getPublicBirthdayCatalog('minsk'))!;
    const demo = catalogue.filter(o => o.id.startsWith(demoId('')));
    assert.equal(demo.length, 35);
    assert.ok(!catalogue.some(o => o.id === demoId('withdrawn') || o.id === demoId('other-city')));
    assert.equal((await getPublicBirthdayCatalog('vitebsk'))!.filter(o => o.id === demoId('other-city')).length, 1);
    const parent = await prisma.user.findUniqueOrThrow({ where: { id: demoId('parent') } });
    assert.ok(await verifyPassword(DEMO_PASSWORD, parent.passwordHash!));
    assert.equal(await prisma.familyMembership.count({ where: { familyId: demoId('family'), leftAt: null } }), 2);
    assert.equal(await prisma.child.count({ where: { familyId: demoId('family') } }), 1);
    assert.ok(demo.some(o => !matchesBirthdayRequirements(o, { ageMonths: 96 })));
    assert.ok(demo.some(o => !matchesBirthdayRequirements(o, { children: 8 })));
    assert.ok(demo.some(o => !matchesBirthdayRequirements(o, { maxBudget: 500 })));
    assert.equal(isAllowedBase(demo.find(o => o.id === demoId('package-home'))!, 'HOME'), true);
    assert.equal(isAllowedBase(demo.find(o => o.id === demoId('package-all'))!, 'HOME'), false);
    const availability = (offerId: string, timeFrom: string, timeTo: string) => previewPartyOfferAvailability({
      offerId: demoId(offerId), date: dates.partyDate, timeFrom, timeTo, childrenCount: 8, adultsCount: 4,
    });
    assert.equal((await availability('venue-1', '12:00', '14:00')).availability, 'UNAVAILABLE');
    assert.equal((await availability('venue-1', '14:00', '16:00')).availability, 'AVAILABLE');
    assert.equal((await availability('package-all', '12:00', '14:00')).availability, 'UNAVAILABLE', 'package cannot bypass the occupied shared hall');
    assert.equal((await availability('package-all', '14:00', '16:00')).availability, 'AVAILABLE');
    assert.notEqual((await availability('show-3', '14:00', '16:00')).availability, 'AVAILABLE');
    const shared = await prisma.bookingUnitOffer.findMany({ where: { bookingUnitId: demoId('unit-venue-1') } });
    assert.deepEqual(new Set(shared.map(o => o.offerId)), new Set([demoId('venue-1'), demoId('package-all')]));
    const created = await createPartyDraft(parent.id, { citySlug: 'minsk', venueMode: 'PACKAGE' });
    const selected = await updatePartyDraft(parent.id, created.id, { version: created.version, anchorOfferId: demoId('package-all'), addonOfferIds: [] });
    assert.equal(selected.items.filter(i => i.role === 'INCLUDED').length, 5, 'archived component never enters the snapshot');
    const animator = selected.items.find(i => i.role === 'INCLUDED' && i.category === 'ANIMATOR')!;
    const changed = await updatePartyDraft(parent.id, created.id, { version: selected.version, packageChange: { itemId: animator.id } });
    assert.equal(estimatedMinimum(changed), 800);
    await prisma.offer.update({ where: { id: demoId('package-all') }, data: { priceFrom: 950 } });
    await seedBirthdayDemo(prisma, now);
    assert.equal((await prisma.offer.findUniqueOrThrow({ where: { id: demoId('package-all') } })).priceFrom, 950, 'rerun preserves manual catalogue edits');
    const restored = await readPartyOrder(parent.id, created.id);
    assert.equal(estimatedMinimum(restored), 800, 'catalogue edits never rewrite the snapshot');
    await prisma.offer.update({ where: { id: demoId('package-all') }, data: { priceFrom: 900 } });
    await assert.rejects(() => readPartyOrder(sentinel.id, created.id), /Праздник не найден/);
    const idea = await prisma.offerIdea.create({ data: { userId: sentinel.id, offerId: demoId('photo-1') } });
    await assert.rejects(() => cleanupBirthdayDemo(prisma), /foreign consumers/);
    assert.equal(await prisma.offer.count({ where: { id: { in: DEMO_OFFERS.map(o => demoId(o.key)) } } }), 37);
    await prisma.offerIdea.delete({ where: { id: idea.id } });
    const manualOffer = await prisma.offer.create({ data: { placeId: demoId('place-1'), title: 'Manual content must survive cleanup refusal', kind: 'SERVICE' } });
    await assert.rejects(() => cleanupBirthdayDemo(prisma), /foreign consumers/);
    assert.ok(await prisma.offer.findUnique({ where: { id: manualOffer.id } }));
    await prisma.offer.delete({ where: { id: manualOffer.id } });
    const manualUnit = await prisma.bookingUnit.create({ data: { businessId: demoId('business-1'), name: 'Manual resource must survive cleanup refusal' } });
    await assert.rejects(() => cleanupBirthdayDemo(prisma), /foreign consumers/);
    assert.ok(await prisma.bookingUnit.findUnique({ where: { id: manualUnit.id } }));
    await prisma.bookingUnit.delete({ where: { id: manualUnit.id } });
    const fixturePlace = await prisma.place.findUniqueOrThrow({ where: { id: demoId('place-1') }, select: { cityId: true } });
    // Protect both cascade paths independently: User.createdBy and Business ownership.
    for (const ownership of [
      { createdByUserId: demoId('owner-1'), ownerBusinessId: null },
      { createdByUserId: sentinel.id, ownerBusinessId: demoId('business-1') },
    ]) {
      const manualPlace = await prisma.place.create({ data: { ...ownership, cityId: fixturePlace.cityId,
        title: 'Manual top-level place', shortDesc: 'Nonfixture content must survive', status: 'DRAFT' } });
      const childOffer = await prisma.offer.create({ data: { placeId: manualPlace.id, kind: 'SERVICE', title: 'Manual place offer' } });
      await assert.rejects(() => cleanupBirthdayDemo(prisma), /foreign consumers/);
      assert.ok(await prisma.place.findUnique({ where: { id: manualPlace.id } }));
      assert.ok(await prisma.offer.findUnique({ where: { id: childOffer.id } }));
      await prisma.offer.delete({ where: { id: childOffer.id } });
      await prisma.place.delete({ where: { id: manualPlace.id } });
    }
    await cleanupBirthdayDemo(prisma);
    assert.equal(await prisma.offer.count({ where: { id: { in: DEMO_OFFERS.map(o => demoId(o.key)) } } }), 0);
    assert.ok(await prisma.user.findUnique({ where: { id: sentinel.id } }));
    await cleanupBirthdayDemo(prisma); // repeated cleanup remains safe
    await seedBirthdayDemo(prisma, now); // leave the fixture ready for authenticated manual acceptance
    console.log('PASS real catalogue visibility, authentication, family, seed replay, availability, snapshots and scoped cleanup');
    console.log(JSON.stringify({ visibleOffers: 35, categories: 10, packages: 5, modes: ['EXACT', 'FROM', 'FREE', 'ON_REQUEST'], ...dates }));
  } finally { await prisma.user.delete({ where: { id: sentinel.id } }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); await appPrisma.$disconnect(); });
