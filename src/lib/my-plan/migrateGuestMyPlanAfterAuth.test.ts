import assert from "node:assert/strict";
import type { GuestMyPlanDraftV1 } from "./guestMyPlanDraftStorage";
import { syncGuestMyPlanDraft } from "./migrateGuestMyPlanAfterAuth";

type CapturedCall = { url: string; init: RequestInit };

function makeDraft(): GuestMyPlanDraftV1 {
  return {
    v: 1,
    anonymousId: "anon-1",
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
        } as NonNullable<GuestMyPlanDraftV1["committedBySlot"]["morning"]>["activity"],
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
  });

  const transferredIds = calls.map((call) =>
    JSON.parse(call.init.body as string).activityId,
  );
  assert.deepEqual(transferredIds, ["activity-1", "activity-2"]);
  assert.ok(!transferredIds.includes("activity-not-added"));
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
  await testFailedSaveRejectsSoDraftCanBeRetried();
  await testDraftWithoutCommittedCardsDoesNothing();
  console.log("guest My Plan post-auth migration tests: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
