import assert from "node:assert/strict";
import type { GuestMyPlanDraftV1 } from "./guestMyPlanDraftStorage";
import { buildGuestMyPlanDraftPayload } from "./guestMyPlanDraftStorage";
import { syncGuestMyPlanDraft } from "./migrateGuestMyPlanAfterAuth";
import type { PlanItemWithActivity } from "@/features/my-plan/types/event";

const GUEST_ANON = "5b1f0c2e-7a4d-4c1e-9a55-0f7d3e2b6a10";
const EXPOSURE_ONE = "ckexposure00000000000000001";

type CapturedCall = { url: string; init: RequestInit };

function makeDraft(): GuestMyPlanDraftV1 {
  return {
    v: 1,
    anonymousId: GUEST_ANON,
    citySlug: "minsk",
    phase: "engaged",
    authGateVisible: true,
    engagementActionCount: 2,
    freeSearch: false,
    goAdult: true,
    kidRanges: [],
    whenChoice: "tomorrow",
    formatChoice: "any",
    scenarioSlots: [
      {
        slot: "evening",
        activity: {
          id: "activity-not-added",
          title: "Only suggested",
          coverImageUrl: null,
        } as GuestMyPlanDraftV1["scenarioSlots"][number]["activity"],
      },
    ],
    committedBySlot: {
      morning: {
        id: "guest-activity-1-morning-2026-08-27",
        userId: "guest",
        activityId: "activity-1",
        date: "2026-08-27",
        startsAt: "2026-08-27T07:00:00.000Z",
        title: "Morning event",
        coverImageUrl: "/morning.jpg",
        createdAt: "2026-08-26T10:00:00.000Z",
        activity: {
          id: "activity-1",
          title: "Morning event",
          coverImageUrl: "/morning.jpg",
          recommendationExposureId: EXPOSURE_ONE,
          recommendationRunId: "ckrun0000000000000000001",
        } as unknown as NonNullable<GuestMyPlanDraftV1["committedBySlot"]["morning"]>["activity"],
      },
      afternoon: {
        id: "guest-activity-2-afternoon-2026-08-27",
        userId: "guest",
        activityId: "activity-2",
        date: "2026-08-27",
        startsAt: null,
        title: "Afternoon event",
        coverImageUrl: null,
        createdAt: "2026-08-26T10:01:00.000Z",
        activity: {
          id: "activity-2",
          title: "Afternoon event",
          coverImageUrl: null,
        } as NonNullable<GuestMyPlanDraftV1["committedBySlot"]["afternoon"]>["activity"],
      },
    },
    guestRemainingGenerations: 1,
    guestQuotaBlocked: false,
    selectedPlanDateIso: "2026-08-27",
  };
}

async function testOnlyCommittedCardsAreTransferred() {
  const calls: CapturedCall[] = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return { ok: true } as Response;
  }) as typeof fetch;

  const result = await syncGuestMyPlanDraft(makeDraft(), fetchFn);

  assert.deepEqual(result, {
    migratedCount: 2,
    selectedDate: "2026-08-27",
  });
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.url === "/api/save/plan"));

  const firstBody = JSON.parse(calls[0]!.init.body as string);
  assert.deepEqual(firstBody, {
    activityId: "activity-1",
    date: "2026-08-27",
    startsAt: "2026-08-27T07:00:00.000Z",
    title: "Morning event",
    coverImageUrl: "/morning.jpg",
    planAddSource: "recommendation",
    anonymousId: GUEST_ANON,
    recommendationExposureId: EXPOSURE_ONE,
  });

  // A card with no recommendation trace still forwards the guest identity
  // (so a guest-owned run can be matched by the server's fallback) but never
  // invents an exposure id.
  const secondBody = JSON.parse(calls[1]!.init.body as string);
  assert.equal(secondBody.anonymousId, GUEST_ANON);
  assert.equal("recommendationExposureId" in secondBody, false);
  const transferredIds = calls.map((call) =>
    JSON.parse(call.init.body as string).activityId,
  );
  assert.deepEqual(transferredIds, ["activity-1", "activity-2"]);
  assert.ok(!transferredIds.includes("activity-not-added"));
}

async function testMalformedIdentifiersAreNeverForwarded() {
  const draft = makeDraft();
  draft.anonymousId = "not a safe id!!";
  const morning = draft.committedBySlot.morning!;
  (morning.activity as unknown as Record<string, unknown>).recommendationExposureId = "x".repeat(500);
  const calls: CapturedCall[] = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return { ok: true } as Response;
  }) as typeof fetch;
  await syncGuestMyPlanDraft(draft, fetchFn);
  for (const call of calls) {
    const body = JSON.parse(call.init.body as string);
    assert.equal("anonymousId" in body, false, "malformed anonymousId must not be sent");
    assert.equal("recommendationExposureId" in body, false, "oversized exposure id must not be sent");
  }
}

async function testGuestGeneratedRecommendationSurvivesPersistAuthSync() {
  // guest generate response -> committed card (activity carries the trace)
  // -> draft persisted (JSON round trip, as localStorage does)
  // -> auth -> syncGuestMyPlanDraft -> /api/save/plan body.
  const committed: PlanItemWithActivity = {
    id: "guest-activity-9-morning-2026-10-01",
    userId: "guest",
    activityId: "activity-9",
    date: "2026-10-01",
    startsAt: null,
    title: "Recommended",
    coverImageUrl: null,
    createdAt: new Date("2026-09-30T10:00:00.000Z"),
    activity: {
      id: "activity-9",
      title: "Recommended",
      recommendationExposureId: "ckexposure00000000000000009",
      recommendationRunId: "ckrun0000000000000000009",
    },
  } as unknown as PlanItemWithActivity;

  const draft = buildGuestMyPlanDraftPayload({
    anonymousId: GUEST_ANON,
    citySlug: "minsk",
    phase: "engaged",
    authGateVisible: true,
    engagementActionCount: 1,
    freeSearch: false,
    goAdult: false,
    kidRanges: ["3-5"],
    whenChoice: "tomorrow",
    formatChoice: "any",
    scenarioSlots: [],
    committedBySlot: { morning: committed },
    guestRemainingGenerations: 1,
    guestQuotaBlocked: false,
    selectedPlanDateIso: "2026-10-01",
  });
  assert.deepEqual(draft.committedBySlot.morning!.recommendationTrace, {
    exposureId: "ckexposure00000000000000009",
    runId: "ckrun0000000000000000009",
  }, "trace is an explicit typed field of the persisted draft");

  const restored = JSON.parse(JSON.stringify(draft));
  const calls: CapturedCall[] = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return { ok: true } as Response;
  }) as typeof fetch;
  await syncGuestMyPlanDraft(restored, fetchFn);

  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0]!.init.body as string);
  assert.equal(body.activityId, "activity-9");
  assert.equal(body.anonymousId, GUEST_ANON, "same guest anonymousId is sent");
  assert.equal(body.recommendationExposureId, "ckexposure00000000000000009", "exposure of that very activity is sent");
}

async function testFailedSaveRejectsSoDraftCanBeRetried() {
  let call = 0;
  const fetchFn = (async () => {
    call += 1;
    return { ok: call === 1 } as Response;
  }) as typeof fetch;

  await assert.rejects(
    () => syncGuestMyPlanDraft(makeDraft(), fetchFn),
    /guest_plan_save_failed/,
  );
  assert.equal(call, 2);
}

async function testDraftWithoutCommittedCardsDoesNothing() {
  const draft = makeDraft();
  draft.committedBySlot = {};
  let calls = 0;
  const fetchFn = (async () => {
    calls += 1;
    return { ok: true } as Response;
  }) as typeof fetch;

  const result = await syncGuestMyPlanDraft(draft, fetchFn);
  assert.equal(calls, 0);
  assert.deepEqual(result, {
    migratedCount: 0,
    selectedDate: "2026-08-27",
  });
}

async function main() {
  await testOnlyCommittedCardsAreTransferred();
  await testMalformedIdentifiersAreNeverForwarded();
  await testGuestGeneratedRecommendationSurvivesPersistAuthSync();
  await testFailedSaveRejectsSoDraftCanBeRetried();
  await testDraftWithoutCommittedCardsDoesNothing();
  console.log("guest My Plan post-auth migration tests: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
