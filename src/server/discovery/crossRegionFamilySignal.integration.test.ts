import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prismaBase as db } from "@/lib/prisma";
import { readCrossRegionEligibility } from "./crossRegionFamilySignal";
import { buildKudaDiscoveryWhere, getKudaDiscoveryFeed } from "./kudaDiscoveryFeed";
import { getDiscoveryRegionContext } from "@/server/geo/boostRegionTargeting";
import { invalidateTerritoryScopeCache } from "@/server/territory/territoryScope";

if (!process.env.DATABASE_URL) throw new Error("An isolated PostgreSQL DATABASE_URL is required");
const tag = `geo-${randomUUID()}`;
const now = new Date();
const old = new Date(now.getTime() - 14 * 86400000);
const future = new Date(now.getTime() + 86400000);
const ids: string[] = [];
const families: string[] = [];
const cities: string[] = [];
const territories: string[] = [];
let eventId = "";
let localId = "";
let countryId = "";
let regionId = "";
let extraRegionId = "";
let createdCountry = false;
let createdTerritoryCountry = false;
let territoryCountryId = "";

async function main() {
  try {
    const existing = await db.country.findUnique({ where: { slug: "belarus" } });
    const country = existing ?? await db.country.create({ data: { name: tag, slug: "belarus", isActive: true } });
    countryId = country.id; createdCountry = !existing;
    const region = await db.region.create({ data: { countryId, name: tag, slug: tag, type: "OBLAST", isActive: true } });
    regionId = region.id;
    const minsk = await db.city.create({ data: { countryId, regionId, name: "Минск", slug: tag } });
    const gorka = await db.city.create({ data: { countryId, regionId, name: "Марьина Горка", slug: `${tag}-gorka` } });
    const brest = await db.city.create({ data: { countryId, name: "Брест", slug: `${tag}-brest` } });
    cities.push(minsk.id, gorka.id, brest.id);
    const tcExisting = await db.territory.findUnique({ where: { isoCode: "BY" } });
    const tc = tcExisting ?? await db.territory.create({ data: { type: "COUNTRY", isoCode: "BY", slug: `${tag}-country`, name: tag, isActive: true } });
    territoryCountryId = tc.id; createdTerritoryCountry = !tcExisting;
    const tr = await db.territory.create({ data: { type: "REGION", parentId: tc.id, slug: tag, name: tag, isActive: true } });
    territories.push(tr.id);
    for (const [city, slug] of [[minsk, `${tag}-strict`], [gorka, gorka.slug]] as const) {
      const t = await db.territory.create({ data: { type: "CITY", parentId: tr.id, slug, name: city.name, isActive: true } });
      territories.push(t.id);
      await db.territoryLegacyMap.create({ data: { legacyKind: "CITY", legacyId: city.id, territoryId: t.id } });
    }
    const owner = await db.user.create({ data: { email: `${tag}-owner@example.invalid` } }); ids.push(owner.id);
    const activityData = { ownerUserId: owner.id, title: tag, shortDesc: tag, type: "EVENT" as const, scheduleMode: "ONE_TIME" as const, ageTags: [], nextOccurrenceAt: future, status: "PUBLISHED" as const };
    const event = await db.activity.create({ data: { ...activityData, cityId: brest.id } }); eventId = event.id;
    const local = await db.activity.create({ data: { ...activityData, cityId: gorka.id, territoryId: territories[2] } }); localId = local.id;
    const home = [minsk.id, gorka.id];
    const signal = () => readCrossRegionEligibility(minsk.id, home, now);
    for (let i = 0; i < 50; i++) {
      const u = await db.user.create({ data: { email: `${tag}-${i}@example.invalid`, phoneE164: `+${Date.now()}${i}`, phoneVerifiedAt: old } }); ids.push(u.id);
      const f = await db.family.create({ data: { name: tag, homeCityId: minsk.id, createdAt: old, updatedAt: old, memberships: { create: { userId: u.id, role: "OWNER", joinedAt: old } } } }); families.push(f.id);
      if (i < 49) await db.planItem.create({ data: { userId: u.id, familyId: f.id, activityId: event.id } });
    }
    assert.equal((await signal()).length, 0, "49 families do not qualify");
    await db.planItem.create({ data: { userId: ids[50], familyId: families[49], activityId: event.id } });
    assert.equal((await signal())[0]?.familyCount, 50, "50 verified families qualify");
    await db.planItem.create({ data: { userId: ids[1], familyId: families[0], activityId: event.id, date: "2030-01-01" } });
    assert.equal((await signal())[0]?.familyCount, 50, "repeated additions count once");
    const parent = await db.user.create({ data: { email: `${tag}-parent@example.invalid`, phoneE164: `+${Date.now()}999`, phoneVerifiedAt: old } }); ids.push(parent.id);
    await db.familyMembership.create({ data: { userId: parent.id, familyId: families[0], joinedAt: old } });
    await db.planItem.create({ data: { userId: parent.id, familyId: families[0], activityId: event.id } });
    assert.equal((await signal())[0]?.familyCount, 50, "two parents are one family");
    await db.planItem.updateMany({ where: { familyId: families[49] }, data: { cancelledAt: now } });
    assert.equal((await signal()).length, 0, "cancellation immediately drops below threshold");
    await db.planItem.updateMany({ where: { familyId: families[49] }, data: { cancelledAt: null } });
    for (const status of ["BANNED", "SUSPENDED", "LIMITED"] as const) {
      await db.user.update({ where: { id: ids[50] }, data: { status } });
      assert.equal((await signal()).length, 0, `${status} excluded`);
    }
    await db.user.update({ where: { id: ids[50] }, data: { status: "ACTIVE", phoneVerifiedAt: null } });
    assert.equal((await signal()).length, 0, "unverified phone excluded");
    await db.user.update({ where: { id: ids[50] }, data: { phoneVerifiedAt: old } });
    await db.family.update({ where: { id: families[49] }, data: { createdAt: now } });
    assert.equal((await signal()).length, 0, "new family excluded");
    await db.family.update({ where: { id: families[49] }, data: { createdAt: old } });
    for (const role of ["ADMIN", "MODERATOR"] as const) {
      await db.user.update({ where: { id: ids[50] }, data: { role } });
      assert.equal((await signal()).length, 0, `${role} is excluded from family promotion`);
    }
    await db.user.update({ where: { id: ids[50] }, data: { role: "USER", deletedAt: now } });
    assert.equal((await signal()).length, 0, "deleted contributor is excluded");
    await db.user.update({ where: { id: ids[50] }, data: { deletedAt: null } });
    await db.family.update({ where: { id: families[49] }, data: { archivedAt: now } });
    assert.equal((await signal()).length, 0, "archived family is excluded");
    await db.family.update({ where: { id: families[49] }, data: { archivedAt: null } });
    const organiserMembership = await db.familyMembership.create({ data: { familyId: families[49], userId: owner.id, joinedAt: old } });
    assert.equal((await signal()).length, 0, "organiser family cannot inflate own event through another parent");
    await db.familyMembership.delete({ where: { id: organiserMembership.id } });
    await db.familyMembership.updateMany({ where: { familyId: families[49] }, data: { leftAt: now } });
    assert.equal((await signal()).length, 0, "departed members no longer contribute");
    await db.familyMembership.updateMany({ where: { familyId: families[49] }, data: { leftAt: null } });
    await db.family.update({ where: { id: families[49] }, data: { homeCityId: brest.id } });
    assert.equal((await signal()).length, 0, "families in another home region do not count");
    await db.family.update({ where: { id: families[49] }, data: { homeCityId: minsk.id } });
    await db.planItem.updateMany({ where: { familyId: families[49] }, data: { date: "2000-01-01" } });
    assert.equal((await signal()).length, 0, "past session plans cannot promote a future recurrence");
    await db.planItem.updateMany({ where: { familyId: families[49] }, data: { date: null, status: "PROPOSED" } });
    assert.equal((await signal()).length, 0, "unconfirmed proposals do not count");
    await db.planItem.updateMany({ where: { familyId: families[49] }, data: { status: "CONFIRMED" } });
    const filters = { categorySlugs: [], genreSlugs: [], dateRange: null, free: false, priceMin: null, priceMax: null, districtId: null, metroId: null, adultOnly: false };
    const list = async (strict = false) => {
      const { where } = await buildKudaDiscoveryWhere(minsk.id, tag, { eventFilters: filters, ...(strict ? { explicitTerritorySlug: `${tag}-strict` } : {}) });
      return (await db.activity.findMany({ where, select: { id: true } })).map(row => row.id);
    };
    assert.ok((await list()).includes(local.id), "Minsk hub includes Marina Gorka");
    assert.ok((await list()).includes(event.id), "50 families admit Brest");
    const load = () => getKudaDiscoveryFeed(minsk.id, tag, null, { hydrateImages: false, eventFilters: filters });
    assert.equal((await load()).find(card => card.id === event.id)?.crossRegionReason, "FAMILY_SIGNAL");
    assert.ok(!(await list(true)).includes(event.id), "strict geo rejects family exception");
    assert.ok(!(await list(true)).includes(local.id), "strict city rejects other cities of same oblast");
    await db.planItem.deleteMany({ where: { familyId: families[49] } });
    assert.ok(!(await list()).includes(event.id), "deleted plan reduces live eligibility");
    const override = await db.crossRegionEditorialOverride.create({ data: { activityId: event.id, regionId, reason: "Значимое событие", createdById: owner.id, expiresAt: future } });
    assert.equal((await signal())[0]?.reason, "EDITORIAL_OVERRIDE");
    assert.equal((await load()).find(card => card.id === event.id)?.crossRegionReason, "EDITORIAL_OVERRIDE");
    assert.ok((await list()).includes(event.id));
    assert.ok(!(await list(true)).includes(event.id), "strict geo rejects editorial exception");
    await db.crossRegionEditorialOverride.update({ where: { id: override.id }, data: { expiresAt: now } });
    assert.equal((await signal()).length, 0, "expiry boundary is exclusive");
    assert.ok(!(await list()).includes(event.id), "expired override disappears immediately");
    await db.boost.create({ data: { activityId: event.id, startAt: old, endAt: future, purchaseRequestKey: tag, targetRegionIds: [regionId] } });
    assert.ok((await list()).includes(event.id), "targeted paid Boost admits Brest");
    const promoted = (await load()).find(card => card.id === event.id);
    assert.equal(promoted?.crossRegionReason, "PAID_BOOST");
    assert.equal(promoted?.isPromoted, true);
    assert.ok(promoted?.exposureId);
    const exposure = await db.recommendationExposure.findUniqueOrThrow({ where: { id: promoted.exposureId } });
    assert.deepEqual(exposure.reasonCodes, ["PAID_BOOST"]);
    assert.equal((exposure.scoreBreakdown as { isPromoted: boolean }).isPromoted, true);
    const freeWhere = await buildKudaDiscoveryWhere(minsk.id, tag, { eventFilters: { ...filters, free: true } });
    assert.equal(await db.activity.count({ where: { AND: [freeWhere.where, { id: event.id }] } }), 0, "paid exception never bypasses price filter");
    assert.ok(!(await list(true)).includes(event.id), "strict geo rejects paid exception");
    await db.boost.update({ where: { purchaseRequestKey: tag }, data: { targetRegionIds: ["other-region"] } });
    assert.ok(!(await list()).includes(event.id), "Boost for another region does not admit an event");
    await db.boost.update({ where: { purchaseRequestKey: tag }, data: { targetRegionIds: ["*"], endAt: now } });
    assert.ok(!(await list()).includes(event.id), "expired Boost disappears immediately");
    assert.equal(await getDiscoveryRegionContext(minsk.id, tag), regionId);
    const existingOblast = await db.region.findFirst({ where: { countryId, slug: "minskaya-oblast" } });
    const oblast = existingOblast ?? await db.region.create({ data: { countryId, slug: "minskaya-oblast", name: "Минская область", type: "OBLAST", isActive: true } });
    if (!existingOblast) extraRegionId = oblast.id;
    const existingCapital = await db.city.findFirst({ where: { countryId, slug: "minsk" } });
    const capital = existingCapital ?? await db.city.create({ data: { countryId, regionId, slug: "minsk", name: "Минск" } });
    if (!existingCapital) cities.push(capital.id);
    assert.equal(await getDiscoveryRegionContext(capital.id, "minsk"), oblast.id, "Minsk targeting normalises to oblast even with a separate legacy region");
    const previousConfig = process.env.CROSS_REGION_FAMILY_THRESHOLDS;
    try {
      process.env.CROSS_REGION_FAMILY_THRESHOLDS = JSON.stringify({ "minskaya-oblast": 49 });
      assert.equal((await readCrossRegionEligibility(capital.id, home, now))[0]?.familyCount, 49, "Minsk uses oblast threshold, not legacy capital region threshold");
    } finally {
      if (previousConfig === undefined) delete process.env.CROSS_REGION_FAMILY_THRESHOLDS;
      else process.env.CROSS_REGION_FAMILY_THRESHOLDS = previousConfig;
    }
    console.log("cross-region PostgreSQL behavior: OK");
  } finally {
    await db.recommendationRun.deleteMany({ where: { cityId: cities[0] ?? "" } });
    await db.boost.deleteMany({ where: { activityId: eventId } });
    await db.planItem.deleteMany({ where: { familyId: { in: families } } });
    await db.family.deleteMany({ where: { id: { in: families } } });
    await db.activity.deleteMany({ where: { id: { in: [eventId, localId].filter(Boolean) } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.territoryLegacyMap.deleteMany({ where: { territoryId: { in: territories } } });
    for (const id of [...territories].reverse()) await db.territory.delete({ where: { id } });
    if (createdTerritoryCountry) await db.territory.delete({ where: { id: territoryCountryId } });
    await db.city.deleteMany({ where: { id: { in: cities } } });
    if (extraRegionId) await db.region.delete({ where: { id: extraRegionId } });
    if (regionId) await db.region.delete({ where: { id: regionId } });
    if (createdCountry) await db.country.delete({ where: { id: countryId } });
    invalidateTerritoryScopeCache();
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
