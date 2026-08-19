import assert from "node:assert/strict";

import { EventCommitOrchestrator } from "./EventCommitOrchestrator";
import type { EventCommitWriterLike, ExecuteEventCommitInput } from "./EventCommitOrchestrator";
import type { CommitOperation } from "../types";
import type { EventCommitContext, NormalizedEventCandidate } from "./types";

function operationFixture(overrides: Partial<CommitOperation> = {}): CommitOperation {
  return {
    recordId: "record-1",
    sourceRecordKey: "wordpress-db:events:401",
    targetType: "ACTIVITY",
    action: "CREATE",
    order: 0,
    dependsOn: [],
    rollbackSteps: [],
    ...overrides,
  };
}

/**
 * `CommitOperation.action` is typed as `Extract<MigrationPlanAction, "CREATE" | "UPDATE">`
 * — these tests exist purely to prove the orchestrator's runtime guard
 * holds even if a looser producer (or a bug) ever handed it one, hence the
 * deliberate unsafe cast.
 */
function operationFixtureWithUnsafeAction(action: string): CommitOperation {
  return { ...operationFixture(), action } as unknown as CommitOperation;
}

function candidateFixture(overrides: Partial<NormalizedEventCandidate> = {}): NormalizedEventCandidate {
  return {
    title: "Kids Fest",
    slug: "kids-fest",
    content: "<p>A fun kids event with games and music.</p>",
    excerpt: "A fun kids event",
    status: "publish",
    publishedAt: "2026-01-01 00:00:00",
    modifiedAt: "2026-01-02 00:00:00",
    eventDatesRaw: ["2026-08-15 10:00:00"],
    scheduleDraft: { mode: "ONE_TIME", dates: ["2026-08-15T10:00:00.000Z"] },
    venueNameRaw: "Central Park",
    locationRaw: "Minsk, Central Park",
    addressEventPlaceRaw: "ul. Central, 1",
    cityRaw: "Minsk",
    priceRaw: "10 BYN",
    ticketUrlRaw: "https://tickets.example.com/kids-fest",
    externalEventId: "ext-401",
    externalLastUpdatedRaw: "2026-01-02 12:00:00",
    trailerUrlRaw: "https://video.example.com/trailer.mp4",
    seo: { title: "SEO Title", focusKeyword: "kids fest" },
    sourceTerms: [{ termId: 30, taxonomy: "events-category", name: "Festival", slug: "festival" }],
    rawMeta: {},
    ...overrides,
  };
}

function contextFixture(overrides: Partial<EventCommitContext> = {}): EventCommitContext {
  return {
    ownerUserId: "user-1",
    ...overrides,
  };
}

function createFakeWriter(options: { activityId?: string; throwError?: Error } = {}) {
  const calls: unknown[] = [];
  const writer: EventCommitWriterLike = {
    createEventFromDraft: async (draft) => {
      calls.push(draft);
      if (options.throwError) {
        throw options.throwError;
      }
      return { activityId: options.activityId ?? "activity-1", status: "CREATED" as const };
    },
    updateEventFromDraft: async (activityId, draft) => {
      calls.push({ activityId, draft });
      if (options.throwError) {
        throw options.throwError;
      }
      return { activityId, status: "UPDATED" as const };
    },
  };
  return { writer, calls };
}

function inputFixture(overrides: Partial<ExecuteEventCommitInput> = {}): ExecuteEventCommitInput {
  return {
    operation: operationFixture(),
    candidate: candidateFixture(),
    context: contextFixture(),
    ...overrides,
  };
}

async function testHappyPathCreatesEvent() {
  const { writer, calls } = createFakeWriter({ activityId: "activity-42" });
  const orchestrator = new EventCommitOrchestrator(writer);

  const result = await orchestrator.execute(inputFixture());

  assert.equal(result.ok, true);
  assert.equal(result.activityId, "activity-42");
  assert.ok(result.draft, "draft must be returned on success");
  assert.equal(result.draft?.title, "Kids Fest");
  assert.equal(calls.length, 1, "writer must be called exactly once");
}

async function testUnsupportedTargetTypePlace() {
  const { writer, calls } = createFakeWriter();
  const orchestrator = new EventCommitOrchestrator(writer);

  const result = await orchestrator.execute(
    inputFixture({ operation: operationFixture({ targetType: "PLACE" }) }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "UNSUPPORTED_TARGET_TYPE");
  assert.equal(calls.length, 0, "writer must never be called for an unsupported target type");
}

async function testUnsupportedActionUpdate() {
  const { writer, calls } = createFakeWriter();
  const orchestrator = new EventCommitOrchestrator(writer);

  const result = await orchestrator.execute(
    inputFixture({ operation: operationFixture({ action: "UPDATE" }) }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "EVENT_UPDATE_TARGET_MISSING");
  assert.equal(calls.length, 0);
}

async function testUpdateWithTargetActivityIdCallsUpdateNotCreate() {
  const { writer, calls } = createFakeWriter({ activityId: "activity-42" });
  const orchestrator = new EventCommitOrchestrator(writer);

  const result = await orchestrator.execute(
    inputFixture({
      operation: operationFixture({ action: "UPDATE" }),
      targetActivityId: "activity-99",
    }),
  );

  assert.equal(result.ok, true);
  assert.equal(result.activityId, "activity-99");
  assert.equal(calls.length, 1);
  const call = calls[0] as { activityId: string; draft: { title: string } };
  assert.equal(call.activityId, "activity-99");
  assert.equal(call.draft.title, "Kids Fest");
}

async function testUnsupportedActionSkipUnchanged() {
  const { writer, calls } = createFakeWriter();
  const orchestrator = new EventCommitOrchestrator(writer);

  const result = await orchestrator.execute(
    inputFixture({ operation: operationFixtureWithUnsafeAction("SKIP_UNCHANGED") }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "UNSUPPORTED_OPERATION_ACTION");
  assert.equal(calls.length, 0);
}

async function testUnsupportedActionSkipPolicy() {
  const { writer, calls } = createFakeWriter();
  const orchestrator = new EventCommitOrchestrator(writer);

  const result = await orchestrator.execute(
    inputFixture({ operation: operationFixtureWithUnsafeAction("SKIP_POLICY") }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "UNSUPPORTED_OPERATION_ACTION");
  assert.equal(calls.length, 0);
}

async function testUnsupportedActionFail() {
  const { writer, calls } = createFakeWriter();
  const orchestrator = new EventCommitOrchestrator(writer);

  const result = await orchestrator.execute(
    inputFixture({ operation: operationFixtureWithUnsafeAction("FAIL") }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "UNSUPPORTED_OPERATION_ACTION");
  assert.equal(calls.length, 0);
}

async function testBlockedDraftNeverCallsWriter() {
  const { writer, calls } = createFakeWriter();
  const orchestrator = new EventCommitOrchestrator(writer);

  const result = await orchestrator.execute(
    inputFixture({ candidate: candidateFixture({ scheduleDraft: null, eventDatesRaw: [] }) }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "EVENT_CREATE_BLOCKED");
  assert.ok(result.blockReasons && result.blockReasons.length > 0);
  assert.ok(result.blockReasons?.some((reason) => reason.code === "MISSING_SCHEDULE"));
  assert.equal(calls.length, 0, "writer must never be called when the draft is blocked");
}

async function testWriterThrowsBecomesTypedFailureNotThrow() {
  const { writer } = createFakeWriter({ throwError: new Error("db unavailable") });
  const orchestrator = new EventCommitOrchestrator(writer);

  const result = await orchestrator.execute(inputFixture());

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "EVENT_CREATE_FAILED");
  assert.equal(result.error?.message, "db unavailable");
}

async function main() {
  await testHappyPathCreatesEvent();
  await testUnsupportedTargetTypePlace();
  await testUnsupportedActionUpdate();
  await testUpdateWithTargetActivityIdCallsUpdateNotCreate();
  await testUnsupportedActionSkipUnchanged();
  await testUnsupportedActionSkipPolicy();
  await testUnsupportedActionFail();
  await testBlockedDraftNeverCallsWriter();
  await testWriterThrowsBecomesTypedFailureNotThrow();
}

main()
  .then(() => {
    console.log("EventCommitOrchestrator tests: OK");
  })
  .catch((error) => {
    console.error("EventCommitOrchestrator tests: FAILED", error);
    process.exitCode = 1;
  });
