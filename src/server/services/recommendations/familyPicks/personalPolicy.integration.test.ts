import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma, prismaBase } from "@/lib/prisma";
import { loadPersonalFamilyPicks, FamilyPicksSelectionUnavailableError } from "./load";
import { loadFamilyPicksProfile } from "./profile";

const url = new URL(process.env.DATABASE_URL ?? "http://missing");
if (process.env.FAMILY_PICKS_TEST_DB !== "1" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.endsWith("_test")) {
  throw new Error("Explicit isolated local *_test PostgreSQL required; never DEV/PROD");
}
const db = prismaBase;
const marker = randomUUID();
const now = new Date("2030-11-02T12:00:00+03:00");
const date = (day: string) => new Date(`2030-11-${day}T12:00:00+03:00`);
const all = { mode: "ALL_FAMILY" } as const;
const userIds: string[] = [], familyIds: string[] = [], activityIds: string[] = [];
let cityId: string | null = null;
const previousFlag = process.env.FAMILY_CORE_READS;

async function main() {
  try {
    const country = await db.country.upsert({ where: { isoCode: "BY" }, update: {}, create: { isoCode: "BY", name: "Synthetic Belarus", slug: "belarus" } });
    const city = await db.city.create({ data: { countryId: country.id, name: "Policy test city", slug: `policy-${marker}` } });
    cityId = city.id;
    const owner = await db.user.create({ data: { email: `policy-owner-${marker}@example.invalid` } });
    const other = await db.user.create({ data: { email: `policy-other-${marker}@example.invalid` } });
    userIds.push(owner.id, other.id);
    const family = await db.family.create({ data: { name: marker } });
    const foreignFamily = await db.family.create({ data: { name: `foreign-${marker}` } });
    familyIds.push(family.id, foreignFamily.id);
    await db.familyMembership.createMany({ data: [{ userId: owner.id, familyId: family.id, role: "OWNER" }, { userId: other.id, familyId: foreignFamily.id, role: "OWNER" }] });
    const first = await db.child.create({ data: { parentId: owner.id, familyId: family.id, birthDate: new Date("2024-11-06Z"), birthPrecision: "DAY" } });
    const second = await db.child.create({ data: { parentId: other.id, familyId: family.id, birthDate: new Date("2020-11-06Z"), birthPrecision: "MONTH" } });
    const foreign = await db.child.create({ data: { parentId: other.id, familyId: foreignFamily.id, birthDate: new Date("2024-01-01Z"), birthPrecision: "DAY" } });
    process.env.FAMILY_CORE_READS = "0";
    assert.deepEqual((await loadFamilyPicksProfile(owner.id)).children.map(child => child.id), [first.id]);
    process.env.FAMILY_CORE_READS = "1";
    assert.deepEqual(new Set((await loadFamilyPicksProfile(owner.id)).children.map(child => child.id)), new Set([first.id, second.id]));
    const load = () => loadPersonalFamilyPicks({ userId: owner.id, citySlug: city.slug, selection: all, now });
    const runsBefore = await db.recommendationRun.count({ where: { userId: owner.id } });
    const exposuresBefore = await db.recommendationExposure.count({ where: { run: { userId: owner.id } } });
    async function event(title: string, day: string | null, patch: { status?: "DRAFT" | "ARCHIVED" | "SCHEDULED"; withdrawn?: boolean; sale?: boolean | null; ageMinMonths?: number; ageMaxMonths?: number; scheduleMode?: "ALWAYS" | "ON_DEMAND" } = {}) {
      const activity = await db.activity.create({ data: {
        ownerUserId: owner.id, cityId: city.id, title, shortDesc: "Synthetic only", type: "EVENT", status: patch.status ?? "PUBLISHED",
        agePolicy: "SPECIFIC", ageMinMonths: patch.ageMinMonths ?? 0, ageMaxMonths: patch.ageMaxMonths ?? 216,
        ageTags: [], scheduleMode: patch.scheduleMode ?? "MULTI_DATE", nextOccurrenceAt: day ? date(day) : null,
        ...(day ? { sessions: { create: { startsAt: date(day), withdrawnAt: patch.withdrawn ? now : null, isSaleOpen: patch.sale ?? null } } } : {}),
      } });
      activityIds.push(activity.id);
      return activity;
    }
    const closed = await event("Closed sale is not sold out", "07", { sale: false });
    const multi = await event("Birthday chooses later session", "04", { ageMinMonths: 72, ageMaxMonths: 72 });
    await db.activitySession.create({ data: { activityId: multi.id, startsAt: date("07") } });
    await event("Withdrawn must not resurrect nextOccurrence", "05", { withdrawn: true });
    await event("Draft", "05", { status: "DRAFT" });
    await event("Cancelled publication", "05", { status: "ARCHIVED" });
    await event("Scheduled not published", "05", { status: "SCHEDULED" });
    await event("Unconfirmed always", null, { scheduleMode: "ALWAYS" });
    await event("Unconfirmed on demand", null, { scheduleMode: "ON_DEMAND" });
    await event("Already past today", "01");
    const result = await load();
    assert.equal(result.window.horizonDays, 7);
    assert.deepEqual(new Set(result.items.map(item => item.id)), new Set([closed.id, multi.id]));
    assert.equal(result.items.find(item => item.id === multi.id)?.startsAt, date("07").toISOString());
    assert.deepEqual(result.items.find(item => item.id === multi.id)?.matchedChildIds, [first.id]);
    assert.equal(result.items.find(item => item.id === multi.id)?.allChildrenMatch, false);
    assert.ok(result.items[0]?.allChildrenMatch, "AND precedes OR");
    await assert.rejects(loadPersonalFamilyPicks({ userId: owner.id, citySlug: city.slug, selection: { mode: "CHILD", selectedChildId: foreign.id }, now }), FamilyPicksSelectionUnavailableError);
    const single = await loadPersonalFamilyPicks({ userId: owner.id, citySlug: city.slug, selection: { mode: "CHILD", selectedChildId: second.id }, now });
    assert.deepEqual(single.items.map(item => item.id), [closed.id]);
    await db.familyMembership.updateMany({ where: { userId: other.id, leftAt: null }, data: { leftAt: now } });
    await db.familyMembership.create({ data: { userId: other.id, familyId: family.id, role: "ADULT" } });
    await db.userEvent.create({ data: { userId: other.id, familyId: family.id, eventType: "DISMISS", entityType: "EVENT", entityId: closed.id, createdAt: now } });
    assert.ok((await load()).items.some(item => item.id === closed.id), "another adult's dismissal must not exclude my recommendation");
    const ownDismissal = await db.userEvent.create({ data: { userId: owner.id, familyId: family.id, eventType: "DISMISS", entityType: "EVENT", entityId: closed.id, createdAt: now } });
    assert.deepEqual((await load()).items.map(item => item.id), [multi.id]);
    await db.userEvent.delete({ where: { id: ownDismissal.id } });
    const planned = await db.planItem.create({ data: { userId: owner.id, familyId: family.id, activityId: closed.id, title: "Already planned" } });
    assert.deepEqual((await load()).items.map(item => item.id), [multi.id]);
    await db.planItem.delete({ where: { id: planned.id } });
    // No known age matches in week: fallback only after excluding all week candidates.
    await db.activity.updateMany({ where: { id: { in: [closed.id, multi.id] } }, data: { status: "ARCHIVED" } });
    const later = await event("Thirty day fallback", "20");
    const expanded = await load();
    assert.equal(expanded.window.horizonDays, 30);
    assert.deepEqual(expanded.items.map(item => item.id), [later.id]);
    await db.activity.update({ where: { id: later.id }, data: { status: "ARCHIVED" } });
    assert.equal((await load()).status, "EMPTY");
    await db.child.delete({ where: { id: first.id } });
    await assert.rejects(loadPersonalFamilyPicks({ userId: owner.id, citySlug: city.slug, selection: { mode: "CHILD", selectedChildId: first.id }, now }), FamilyPicksSelectionUnavailableError);
    await db.familyMembership.updateMany({ where: { userId: owner.id, leftAt: null }, data: { leftAt: now } });
    assert.deepEqual((await loadFamilyPicksProfile(owner.id)).children, []);
    await assert.rejects(loadPersonalFamilyPicks({ userId: owner.id, citySlug: city.slug, selection: { mode: "CHILD", selectedChildId: second.id }, now }), FamilyPicksSelectionUnavailableError);
    assert.equal((await load()).status, "UNAVAILABLE");
    assert.equal(await db.recommendationRun.count({ where: { userId: owner.id } }), runsBefore);
    assert.equal(await db.recommendationExposure.count({ where: { run: { userId: owner.id } } }), exposuresBefore);
    console.log("Personal family policy PostgreSQL ACL/date/result/zero-trace integration: PASS");
  } finally {
    if (userIds.length) {
      await db.userEvent.deleteMany({ where: { userId: { in: userIds } } });
      await db.planItem.deleteMany({ where: { userId: { in: userIds } } });
    }
    if (activityIds.length) await db.activity.deleteMany({ where: { id: { in: activityIds } } });
    if (familyIds.length) await db.family.deleteMany({ where: { id: { in: familyIds } } });
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
    if (cityId) await db.city.delete({ where: { id: cityId } });
    if (previousFlag === undefined) delete process.env.FAMILY_CORE_READS; else process.env.FAMILY_CORE_READS = previousFlag;
    await prisma.$disconnect();
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
