import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma as db } from "@/lib/prisma";
import { saveHomeEventPlan, recordHomePlanAdd } from "./homePlanAdd";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import { recordRecommendationRun } from "../RecommendationTraceService";
import { readFamilyHomeKpi } from "@/server/services/analytics/familyHomeKpi";
import { homeChipSelectEvent, homeCatalogEvent } from "@/features/city-home/lib/homeInteractionTelemetry";
import { recordPlanAudienceSnapshot } from "@/lib/decision/subjects";

const url = new URL(process.env.DATABASE_URL ?? "http://missing");
if (process.env.FAMILY_PICKS_TEST_DB !== "1" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.endsWith("_test")) {
  throw new Error("Explicit isolated local *_test PostgreSQL required; never DEV/PROD");
}
const marker = randomUUID();
const userIds: string[] = [], familyIds: string[] = [], activityIds: string[] = [];
let cityId: string | undefined;
const from = new Date(Date.now() - 60_000);
const kpi = (patch = {}) => readFamilyHomeKpi({ from, to: new Date(Date.now() + 60_000), cityId, ...patch });
let checks = 0;
function pass(label: string) { checks++; console.log(`ok ${checks} - ${label}`); }
async function main() {
  try {
    const country = await db.country.upsert({ where: { isoCode: "BY" }, update: {}, create: { isoCode: "BY", name: "Synthetic", slug: "belarus" } });
    const city = await db.city.create({ data: { countryId: country.id, name: "Synthetic", slug: `analytics-${marker}` } });
    cityId = city.id;
    const owner = await db.user.create({ data: { email: `home-${marker}@example.invalid` } });
    const other = await db.user.create({ data: { email: `other-home-${marker}@example.invalid` } });
    userIds.push(owner.id, other.id);
    for (const userId of userIds) {
      const family = await db.family.create({ data: { name: "Synthetic" } });
      familyIds.push(family.id);
      await db.familyMembership.create({ data: { userId, familyId: family.id, role: "OWNER" } });
    }
    const child = await db.child.create({ data: { parentId: owner.id, familyId: familyIds[0], name: `PII-NAME-${marker}`, birthDate: new Date("2021-06-15Z") } });
    async function activity() {
      const row = await db.activity.create({ data: { title: "Synthetic event", shortDesc: "Test", type: "EVENT", scheduleMode: "MULTI_DATE", status: "PUBLISHED", cityId, ownerUserId: owner.id } });
      activityIds.push(row.id); return row.id;
    }
    async function exposure(activityId: string, patch: { userId?: string; surface?: "HOME" | "MY_PLAN" | "DISCOVERY"; stale?: boolean; entityType?: "EVENT" | "PLACE" } = {}) {
      const trace = await recordRecommendationRun({ surface: patch.surface ?? "HOME", userId: patch.userId ?? owner.id, cityId,
        algorithmVersion: "home-analytics-test", candidateCount: 1, decisionContext: { intent: "family_picks", subjects: [], actor: { kind: "user", id: patch.userId ?? owner.id } },
        items: [{ entityType: patch.entityType ?? "EVENT", entityId: activityId, position: 1 }] });
      assert.ok(trace);
      const id = [...trace.exposureIdByEntityKey.values()][0];
      if (patch.stale) await db.recommendationExposure.update({ where: { id }, data: { exposedAt: new Date(Date.now() - 121 * 60_000) } });
      return { id, runId: trace.runId };
    }
    async function save(activityId: string, exposureId: string | null, date = "2030-11-04", userId = owner.id) {
      const { planItem, attributionStatus } = await saveHomeEventPlan({ userId, activityId, date,
        visibility: "PRIVATE", exposureId, sessionId: null, cityId: cityId!,
        dateMeta: { planDate: date }, subjectsMeta: {} });
      return { ...planItem, status: attributionStatus };
    }
    const event = await activity();
    const trace = await exposure(event);
    const first = await save(event, trace.id);
    assert.equal(first.created, true); assert.equal(first.status, "recorded");
    const positive = await db.userEvent.findMany({ where: { userId: owner.id, entityId: event, eventType: "PLAN_ADD" } });
    assert.equal(positive.length, 1); assert.equal(positive[0].decisionId, trace.runId);
    const meta = positive[0].meta as Record<string, unknown>;
    assert.equal(meta.planItemId, first.id); assert.equal(meta.section, "home");
    assert.equal(meta.recommendationSurface, "home"); assert.equal(meta.homePlanAddVerified, true);
    assert.equal(meta.placement, "HOME_FOR_FAMILY"); assert.equal(meta.planDate, "2030-11-04");
    assert.equal(await db.recommendationOutcome.count({ where: { userEventId: positive[0].id, exposureId: trace.id } }), 1);
    assert.equal((await kpi()).planAdds, 1);
    const milestone = await db.userEvent.findFirst({ where: { userId: owner.id, eventType: "FIRST_PERSONALIZED_PLAN_ADD" } });
    assert.equal((milestone?.meta as Record<string, unknown>)?.recommendationSurface, "home");
    pass("committed new plan has one immediately observable verified HOME event/outcome/milestone");
    assert.equal((await save(event, trace.id)).status, "existing");
    assert.equal((await save(event, trace.id, "2030-11-05")).status, "existing");
    await recordPlanAudienceSnapshot({ userId: owner.id, sessionId: null, entityType: "EVENT", entityId: event, cityId: cityId!, planItemId: first.id, date: "2030-11-05", subjects: [{ kind: "child", refId: child.id, source: "profile", ageRange: "3-5" }] });
    assert.equal((await kpi()).planAdds, 1);
    assert.equal(await db.userEvent.count({ where: { entityId: event, eventType: "PLAN_ADD" } }), 1);
    assert.equal(await db.userEvent.count({ where: { entityId: event, eventType: "PLAN_AUDIENCE_SNAPSHOT" } }), 1);
    assert.equal((await db.planItem.findUniqueOrThrow({ where: { id: first.id } })).visibility, "PRIVATE");
    pass("retry, move and audience snapshot add no positive signal and retain visibility");
    const concurrentEvent = await activity(), concurrentTrace = await exposure(concurrentEvent);
    const concurrent = await Promise.all([save(concurrentEvent, concurrentTrace.id), save(concurrentEvent, concurrentTrace.id)]);
    assert.equal(concurrent.filter(row => row.created).length, 1);
    assert.equal(new Set(concurrent.map(row => row.id)).size, 1);
    assert.equal(await db.userEvent.count({ where: { entityId: concurrentEvent, eventType: "PLAN_ADD" } }), 1);
    pass("concurrent Home saves serialize through the existing ACL-scoped plan writer");
    for (const kind of ["missing", "invalid", "foreign", "wrong-event", "wrong-type", "my-plan", "discovery", "stale", "guest-auth"] as const) {
      const target = await activity();
      // A matching recent HOME exposure must never rescue a bad explicit claim.
      await exposure(target);
      const wrong = kind === "missing" ? null : kind === "invalid" ? "invalid-exposure" :
        (await exposure(kind === "wrong-event" ? event : target, {
          userId: kind === "foreign" || kind === "guest-auth" ? other.id : owner.id,
          surface: kind === "my-plan" ? "MY_PLAN" : kind === "discovery" ? "DISCOVERY" : "HOME",
          entityType: kind === "wrong-type" ? "PLACE" : "EVENT", stale: kind === "stale",
        })).id;
      const saved = await save(target, wrong);
      assert.equal(saved.created, true); assert.equal(saved.status, "unattributed", kind);
      assert.equal((await kpi({ eventId: target })).planAdds, 0, kind);
      const raw = await db.userEvent.findFirstOrThrow({ where: { entityId: target, eventType: "PLAN_ADD" } });
      assert.equal(raw.decisionId, null, kind);
      assert.equal(await db.recommendationOutcome.count({ where: { userEventId: raw.id } }), 0, kind);
      assert.equal((raw.meta as Record<string, unknown>).recommendationExposureId, undefined, kind);
      pass(`${kind} exposure saves product intent without HOME attribution or fallback`);
    }
    const beforeFailure = await db.userEvent.count({ where: { eventType: "PLAN_ADD", userId: owner.id } });
    await assert.rejects(save(`nonexistent-${marker}`, trace.id));
    assert.equal(await db.userEvent.count({ where: { eventType: "PLAN_ADD", userId: owner.id } }), beforeFailure);
    pass("failed plan DB write produces no PLAN_ADD");
    const outageEvent = await activity(), outageTrace = await exposure(outageEvent);
    await db.$executeRawUnsafe(`CREATE FUNCTION issue1080_fail_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic_outcome_failure'; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER issue1080_fail_outcome BEFORE INSERT ON "RecommendationOutcome" FOR EACH ROW EXECUTE FUNCTION issue1080_fail_outcome()`);
    try {
      const saved = await save(outageEvent, outageTrace.id);
      assert.equal(saved.status, "unavailable");
      assert.ok(await db.planItem.findUnique({ where: { id: saved.id } }));
      assert.equal(await db.userEvent.count({ where: { entityId: outageEvent, eventType: "PLAN_ADD" } }), 0);
      assert.equal((await kpi({ eventId: outageEvent })).planAdds, 0);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER issue1080_fail_outcome ON "RecommendationOutcome"`);
      await db.$executeRawUnsafe(`DROP FUNCTION issue1080_fail_outcome()`);
    }
    pass("analytics outcome failure rolls back event/outcome together, reports unavailable, retains product plan");
    // Transport retries cannot create a second event/outcome.
    const recordedAgain = await recordHomePlanAdd({ userId: owner.id, activityId: event, planItemId: first.id, exposureId: trace.id,
      sessionId: null, cityId: cityId!, dateMeta: {}, subjectsMeta: {} });
    assert.equal(recordedAgain, "recorded");
    assert.equal(await db.userEvent.count({ where: { entityId: event, eventType: "PLAN_ADD" } }), 1);
    pass("server telemetry idempotency key prevents repeated positive outcomes");
    const common = { userId: owner.id, entityType: "EVENT" as const, entityId: event, cityId,
      meta: { source: "recommendation" as const, section: "home" as const, placement: "HOME_FOR_FAMILY", recommendationExposureId: trace.id } };
    for (const eventType of ["CARD_VIEW", "DETAIL_OPEN", "DISMISS"] as const) {
      await trackUserEvent({ ...common, eventType, meta: { ...common.meta, impression: eventType === "CARD_VIEW" } });
    }
    // Raw card opens/returned exposures are not qualified impressions.
    await trackUserEvent({ ...common, eventType: "CARD_VIEW" });
    await trackUserEvent({ ...homeChipSelectEvent(null, child.id, city.slug)!, userId: owner.id, cityId });
    await trackUserEvent({ ...homeCatalogEvent(child.id, city.slug), userId: owner.id, cityId });
    // Legacy outcome linking is intentionally async: only legacy metrics need a short bounded wait.
    for (let i = 0; i < 30; i++) { if ((await kpi()).detailOpens === 1 && (await kpi()).qualifiedImpressions === 1 && (await kpi()).dismissals === 1) break; await new Promise(resolve => setTimeout(resolve, 50)); }
    const metrics = await kpi();
    assert.deepEqual(metrics, { planAdds: 2, qualifiedImpressions: 1, exposedUsers: 1, detailOpens: 1, dismissals: 1, chipChanges: 1, catalogClicks: 1, planAddsPerQualifiedImpression: 2 });
    assert.equal((await kpi({ eventId: event })).planAdds, 1);
    assert.equal((await kpi({ eventId: event })).chipChanges, null);
    assert.equal((await kpi({ userId: other.id })).planAdds, 0);
    assert.equal((await kpi({ cityId: "wrong-city" })).planAdds, 0);
    assert.equal((await readFamilyHomeKpi({ from: new Date(0), to: new Date(1) })).planAdds, 0);
    await assert.rejects(readFamilyHomeKpi({ from, to: from }), /invalid_kpi_period/);
    assert.doesNotMatch(JSON.stringify(metrics), new RegExp(`${owner.id}|${child.id}|${marker}|birthDate|email|refId`));
    const clientMeta = await db.userEvent.findMany({ where: { userId: owner.id, eventType: { in: ["FILTER_APPLY", "CTA_CLICK", "CARD_VIEW", "DETAIL_OPEN", "DISMISS"] } }, select: { meta: true } });
    assert.doesNotMatch(JSON.stringify(clientMeta), new RegExp(`${child.id}|PII-NAME|birthDate|selectedChildId`));
    pass("KPI uses verified distinct plan IDs and qualified views, supports scoped filters, returns no identities");
    console.log(`Family Home analytics PostgreSQL: ${checks} checks PASS`);
  } finally {
    await new Promise(resolve => setTimeout(resolve, 300));
    await db.recommendationRun.deleteMany({ where: { userId: { in: userIds } } });
    await db.userEvent.deleteMany({ where: { userId: { in: userIds } } });
    await db.planItem.deleteMany({ where: { userId: { in: userIds } } });
    await db.activity.deleteMany({ where: { id: { in: activityIds } } });
    await db.child.deleteMany({ where: { parentId: { in: userIds } } });
    await db.familyMembership.deleteMany({ where: { userId: { in: userIds } } });
    await db.family.deleteMany({ where: { id: { in: familyIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    if (cityId) await db.city.delete({ where: { id: cityId } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
