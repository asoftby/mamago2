import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { prisma, prismaBase as db } from "@/lib/prisma";
import { fromZonedTime } from "date-fns-tz";
import { minskDateKey } from "./window";
import { loadHomeContext, saveHomeSelection } from "./homeContext";
import { deliverHomeFamilyPicks, type HomeFamilyDelivery } from "./delivery";
import { resolveHomeRequest } from "./homeRequest";
import { HomeSelectionSync, persistHomeSelection } from "@/features/city-home/lib/homeSelectionSync";
import { FamilyHomeCache } from "@/features/city-home/lib/familyHomeCache";

const url = new URL(process.env.DATABASE_URL ?? "http://missing");
if (process.env.FAMILY_PICKS_TEST_DB !== "1" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.endsWith("_test")) throw new Error("Explicit disposable local *_test database required");
if (process.env.NODE_ENV !== "test" || process.env.PRISMA_QUERY_EVENTS !== "1") throw new Error("Test-only Prisma query instrumentation required");
let queries = 0;
db.$on("query" as never, (() => { queries++; }) as never);
const marker = randomUUID();
const userIds: string[] = [], familyIds: string[] = [], activityIds: string[] = [];
let cityId: string | null = null;
const measurements: { scenario: string; ms: number; sql: number; candidates?: number; cacheHits?: number }[] = [];
async function measure<T>(scenario: string, action: () => Promise<T>): Promise<T> {
  const before = queries, start = performance.now();
  const result = await action();
  measurements.push({ scenario, ms: Math.round(performance.now() - start), sql: queries - before });
  assert.ok(queries > before, "query instrumentation must be active");
  return result;
}
function day(offset: number) {
  const key = minskDateKey(new Date());
  const next = new Date(Date.parse(`${key}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
  return fromZonedTime(`${next}T12:00:00`, "Europe/Minsk");
}
async function main() {
  process.env.FAMILY_CORE_READS = "1";
  try {
    const country = await db.country.upsert({ where: { isoCode: "BY" }, update: {}, create: { isoCode: "BY", name: "Synthetic Belarus", slug: "belarus" } });
    const city = await db.city.create({ data: { countryId: country.id, name: "Delivery test city", slug: `home-${marker}` } });
    cityId = city.id;
    const user = await db.user.create({ data: { email: `home-${marker}@example.invalid` } });
    const stranger = await db.user.create({ data: { email: `home-other-${marker}@example.invalid` } });
    const partner = await db.user.create({ data: { email: `home-partner-${marker}@example.invalid`, displayName: "Таня" } });
    userIds.push(user.id, stranger.id, partner.id);
    const family = await db.family.create({ data: { name: marker } }); familyIds.push(family.id);
    await db.familyMembership.create({ data: { userId: user.id, familyId: family.id, role: "OWNER" } });
    await db.familyMembership.create({ data: { userId: partner.id, familyId: family.id, role: "ADULT" } });
    const first = await db.child.create({ data: { parentId: user.id, familyId: family.id, birthDate: new Date("2020-01-01Z"), birthPrecision: "DAY", name: "Первый" } });
    const second = await db.child.create({ data: { parentId: user.id, familyId: family.id, birthDate: new Date("2022-01-01Z"), birthPrecision: "MONTH", name: "Второй" } });
    const initial = await loadHomeContext(user.id);
    assert.equal(initial.context.selectionPersistence, "account");
    assert.deepEqual(initial.context.adults, [{ name: "Таня", isMe: false }], "only active same-family adult is shown");
    assert.deepEqual((await loadHomeContext(stranger.id)).context.adults, [], "foreign adults never leak into Home");
    assert.ok(await saveHomeSelection(user.id, first.id, initial.context.preferenceVersion));
    const fromAnotherDevice = await loadHomeContext(user.id);
    assert.equal(fromAnotherDevice.context.selectedChildId, first.id);
    assert.equal(await saveHomeSelection(user.id, second.id, initial.context.preferenceVersion), false, "late create must not overwrite a newer choice");
    assert.ok(await saveHomeSelection(user.id, second.id, fromAnotherDevice.context.preferenceVersion));
    assert.equal(await saveHomeSelection(user.id, first.id, fromAnotherDevice.context.preferenceVersion), false, "late update must not overwrite");
    assert.equal((await loadHomeContext(stranger.id)).context.selectedChildId, null);
    await assert.rejects(saveHomeSelection(stranger.id, first.id, null), /selection_unavailable/);
    // Two open devices consume the real account preference, independent of profile hash.
    const tabA = new HomeSelectionSync((await loadHomeContext(user.id)).context);
    const tabB = new HomeSelectionSync((await loadHomeContext(user.id)).context);
    const persistence = {
      context: async () => (await loadHomeContext(user.id)).context,
      save: async (choice: string | null, version: string | null) => {
        const result = await resolveHomeRequest({ action: "selection", city: city.slug, selectedChildId: choice, version }, user.id, null, undefined);
        if (result.status !== 200) throw new Error(`home_${result.status}`);
      },
    };
    assert.equal(await persistHomeSelection(tabA, tabA.begin(first.id), persistence), "saved");
    const beforeOtherDevice = await persistence.context();
    assert.equal(await persistHomeSelection(tabB, tabB.begin(second.id), persistence), "saved");
    const onFocus = await persistence.context();
    assert.equal(onFocus.signature, beforeOtherDevice.signature);
    assert.notEqual(onFocus.preferenceVersion, beforeOtherDevice.preferenceVersion);
    assert.equal(tabA.reconcile(onFocus), second.id, "A → X, B → Y, A focus → Y");
    // A competing write after A's read must cause real API CAS 409 and sync to B.
    const conflict = await persistHomeSelection(tabA, tabA.begin(first.id), {
      ...persistence,
      save: async (choice, version) => {
        assert.ok(await saveHomeSelection(user.id, null, version));
        await persistence.save(choice, version);
      },
    });
    assert.equal(conflict, "conflict");
    assert.equal(tabA.reconcile(await persistence.context()), null);
    const restore = await persistence.context();
    assert.ok(await saveHomeSelection(user.id, second.id, restore.preferenceVersion));
    // Large full pool, no pre-age truncation: 100 UNKNOWN and 700 confirmed.
    for (let i = 0; i < 800; i++) activityIds.push(`home_${marker.replaceAll("-", "")}_${i}`);
    await db.activity.createMany({ data: activityIds.map((id, index) => ({ id, ownerUserId: user.id, cityId: city.id, title: `Synthetic ${index}`, shortDesc: "Disposable benchmark", type: "EVENT", status: "PUBLISHED", agePolicy: index < 100 ? "UNKNOWN" : "SPECIFIC", ageMinMonths: index < 100 ? null : 0, ageMaxMonths: index < 100 ? null : 216, ageTags: [], scheduleMode: "MULTI_DATE", nextOccurrenceAt: day(1), priceMode: "FREE" })) });
    await db.activitySession.createMany({ data: activityIds.map(id => ({ activityId: id, startsAt: day(1) })) });
    const prepared = await loadHomeContext(user.id);
    const signatureOnly = await loadHomeContext(user.id, undefined, { includeSelectionPreference: false });
    assert.equal(signatureOnly.context.signature, prepared.context.signature, "final delivery validation must retain the complete signed ACL/profile fingerprint");
    assert.equal(signatureOnly.context.selectedChildId, null, "signature-only path does not load the independent selection preference");
    const firstDelivery = await measure("800-candidate 30-day final delivery", () => deliverHomeFamilyPicks({ userId: user.id, citySlug: city.slug, ...prepared, selection: { mode: "ALL_FAMILY" }, dismissedIds: [], sessionId: null }));
    assert.equal(firstDelivery.items.length, 10);
    assert.equal(firstDelivery.candidateCount, 800);
    assert.equal(firstDelivery.window.horizonDays, 30);
    assert.ok(firstDelivery.runId);
    assert.ok(firstDelivery.items.every(item => item.exposureId));
    assert.equal(await db.recommendationRun.count({ where: { userId: user.id } }), 1);
    assert.equal(await db.recommendationExposure.count({ where: { run: { userId: user.id } } }), 10);
    const picked = firstDelivery.items[0]!;
    const invalid = await resolveHomeRequest({ action: "dismiss", city: city.slug, eventId: picked.id, exposureId: picked.exposureId, token: randomUUID() }, stranger.id, null, undefined);
    assert.equal(invalid.status, 404);
    const rejected = await resolveHomeRequest({ action: "dismiss", city: city.slug, eventId: picked.id, exposureId: picked.exposureId, token: randomUUID() }, user.id, null, undefined);
    assert.equal(rejected.status, 200);
    assert.notEqual((await loadHomeContext(user.id)).context.signature, prepared.context.signature);
    await assert.rejects(deliverHomeFamilyPicks({ userId: user.id, citySlug: city.slug, ...prepared, selection: { mode: "ALL_FAMILY" }, dismissedIds: [], sessionId: null }), /profile_changed/);
    // Confirmed events later in the 30-day window remain eligible.
    await db.activitySession.updateMany({ where: { activityId: { in: activityIds.slice(100) } }, data: { startsAt: day(20) } });
    await db.activity.updateMany({ where: { id: { in: activityIds.slice(100) } }, data: { nextOccurrenceAt: day(20) } });
    const expandedContext = await loadHomeContext(user.id);
    const beforeFallback = await db.recommendationRun.count({ where: { userId: user.id } });
    const expanded = await measure("800-candidate 30-day final delivery with later sessions", () => deliverHomeFamilyPicks({ userId: user.id, citySlug: city.slug, ...expandedContext, selection: { mode: "ALL_FAMILY" }, dismissedIds: [], sessionId: null }));
    assert.equal(expanded.window.horizonDays, 30);
    assert.equal(expanded.items.length, 10);
    assert.equal(await db.recommendationRun.count({ where: { userId: user.id } }), beforeFallback + 1);
    // Five quick switches: only the three uncached selections deliver/trace.
    const cache = new FamilyHomeCache<HomeFamilyDelivery>(user.id);
    let hits = 0;
    const beforeSwitch = await db.recommendationRun.count({ where: { userId: user.id } });
    await measure("five chip switches, complete 30-day pools", async () => {
      for (const selected of [null, first.id, second.id, null, first.id]) {
        const fresh = await loadHomeContext(user.id);
        let value = cache.get(fresh.context, city.slug, selected);
        if (value) hits++;
        else {
          value = await deliverHomeFamilyPicks({ userId: user.id, citySlug: city.slug, ...fresh, selection: selected ? { mode: "CHILD", selectedChildId: selected } : { mode: "ALL_FAMILY" }, dismissedIds: [], sessionId: null });
          cache.set(fresh.context, city.slug, selected, value);
        }
      }
    });
    measurements[measurements.length - 1]!.cacheHits = hits;
    assert.equal(hits, 2);
    assert.equal(await db.recommendationRun.count({ where: { userId: user.id } }), beforeSwitch + 3);
    // Empty final result never writes a run.
    await db.activity.updateMany({ where: { id: { in: activityIds } }, data: { status: "ARCHIVED" } });
    const emptyContext = await loadHomeContext(user.id);
    const beforeEmpty = await db.recommendationRun.count({ where: { userId: user.id } });
    const empty = await deliverHomeFamilyPicks({ userId: user.id, citySlug: city.slug, ...emptyContext, selection: { mode: "ALL_FAMILY" }, dismissedIds: [], sessionId: null });
    assert.equal(empty.items.length, 0);
    assert.equal(await db.recommendationRun.count({ where: { userId: user.id } }), beforeEmpty);
    await db.child.delete({ where: { id: second.id } });
    assert.equal((await loadHomeContext(user.id)).context.selectedChildId, null, "deleted selected child resets on the account");
    assert.equal((await db.userHomePreference.findUnique({ where: { userId: user.id } }))?.selectedChildId, null);
    await db.familyMembership.updateMany({ where: { userId: user.id, leftAt: null }, data: { leftAt: new Date() } });
    assert.equal((await loadHomeContext(user.id)).context.audience, "no_child_with_DOB");
    assert.deepEqual((await loadHomeContext(user.id)).context.adults, [], "leaving family revokes other adult chips");
    console.log(JSON.stringify({ benchmark: "disposable PostgreSQL 16, 800 events, 2 children, before pool optimization", measurements }, null, 2));
    console.log("Home delivery, account preference, ACL, attribution and cache integration: PASS");
  } finally {
    if (userIds.length) {
      await db.userEvent.deleteMany({ where: { userId: { in: userIds } } });
      await db.recommendationRun.deleteMany({ where: { userId: { in: userIds } } });
      await db.planItem.deleteMany({ where: { userId: { in: userIds } } });
    }
    if (activityIds.length) await db.activity.deleteMany({ where: { id: { in: activityIds } } });
    if (familyIds.length) await db.family.deleteMany({ where: { id: { in: familyIds } } });
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
    if (cityId) await db.city.delete({ where: { id: cityId } });
    await prisma.$disconnect(); await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
