import assert from "node:assert/strict";

import { PlaceCommitOrchestrator } from "./PlaceCommitOrchestrator";
import type { ExecutePlaceCommitInput, PlaceCommitWriterLike } from "./PlaceCommitOrchestrator";
import type { CommitOperation } from "../types";
import type { NormalizedPlaceCandidate, PlaceCommitContext } from "./types";

function operationFixture(overrides: Partial<CommitOperation> = {}): CommitOperation {
  return {
    recordId: "record-1",
    sourceRecordKey: "wordpress-db:places:301",
    targetType: "PLACE",
    action: "CREATE",
    order: 0,
    dependsOn: [],
    rollbackSteps: [],
    ...overrides,
  };
}

/**
 * `CommitOperation.action` is typed as `Extract<MigrationPlanAction, "CREATE" | "UPDATE">`
 * — `CommitExecutionPlan.operations` should never actually contain
 * SKIP_UNCHANGED/SKIP_POLICY/FAIL. These tests exist purely to prove the
 * orchestrator's runtime guard holds even if a looser producer (or a bug)
 * ever handed it one, hence the deliberate unsafe cast.
 */
function operationFixtureWithUnsafeAction(action: string): CommitOperation {
  return { ...operationFixture(), action } as unknown as CommitOperation;
}

function candidateFixture(overrides: Partial<NormalizedPlaceCandidate> = {}): NormalizedPlaceCandidate {
  return {
    title: "Cool Place",
    slug: "cool-place",
    content: "<p>A cool place for kids.</p>",
    excerpt: "A cool place excerpt",
    status: "publish",
    publishedAt: "2026-01-01 00:00:00",
    modifiedAt: "2026-01-02 00:00:00",
    shortDescription: "A great place for kids",
    phone: "+375291234567",
    email: "hello@example.com",
    workHoursRaw: "Mon-Fri 9-18",
    locationRaw: "Minsk, some street",
    cityRaw: "Minsk",
    coordinates: { lat: 53.9, lng: 27.5667 },
    media: { thumbnailAttachmentId: 555, galleryAttachmentIds: [111, 222] },
    seo: { title: "SEO Title", focusKeyword: "kids playground" },
    sourceTerms: [{ termId: 20, taxonomy: "places_category", name: "Cafe", slug: "kids-cafe" }],
    rawMeta: {},
    ...overrides,
  };
}

function contextFixture(overrides: Partial<PlaceCommitContext> = {}): PlaceCommitContext {
  return {
    createdByUserId: "user-1",
    cityId: "city-1",
    category: "кафе",
    ...overrides,
  };
}

function createFakeWriter(options: { placeId?: string; throwError?: Error } = {}) {
  const calls: unknown[] = [];
  const writer: PlaceCommitWriterLike = {
    createPlaceFromDraft: async (draft) => {
      calls.push(draft);
      if (options.throwError) {
        throw options.throwError;
      }
      return { placeId: options.placeId ?? "place-1", status: "CREATED" as const };
    },
  };
  return { writer, calls };
}

function inputFixture(overrides: Partial<ExecutePlaceCommitInput> = {}): ExecutePlaceCommitInput {
  return {
    operation: operationFixture(),
    candidate: candidateFixture(),
    context: contextFixture(),
    ...overrides,
  };
}

async function testHappyPathCreatesPlace() {
  const { writer, calls } = createFakeWriter({ placeId: "place-42" });
  const orchestrator = new PlaceCommitOrchestrator(writer);

  const result = await orchestrator.execute(inputFixture());

  assert.equal(result.ok, true);
  assert.equal(result.placeId, "place-42");
  assert.ok(result.draft, "draft must be returned on success");
  assert.equal(result.draft?.title, "Cool Place");
  assert.deepEqual(result.warnings, []);
  assert.equal(calls.length, 1, "writer must be called exactly once");
}

async function testUnsupportedTargetTypeArticle() {
  const { writer, calls } = createFakeWriter();
  const orchestrator = new PlaceCommitOrchestrator(writer);

  const result = await orchestrator.execute(
    inputFixture({ operation: operationFixture({ targetType: "ARTICLE" }) }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "UNSUPPORTED_TARGET_TYPE");
  assert.equal(calls.length, 0, "writer must never be called for an unsupported target type");
}

async function testUnsupportedActionUpdate() {
  const { writer, calls } = createFakeWriter();
  const orchestrator = new PlaceCommitOrchestrator(writer);

  const result = await orchestrator.execute(
    inputFixture({ operation: operationFixture({ action: "UPDATE" }) }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "UNSUPPORTED_OPERATION_ACTION");
  assert.equal(calls.length, 0);
}

async function testUnsupportedActionSkipUnchanged() {
  const { writer, calls } = createFakeWriter();
  const orchestrator = new PlaceCommitOrchestrator(writer);

  const result = await orchestrator.execute(
    inputFixture({ operation: operationFixtureWithUnsafeAction("SKIP_UNCHANGED") }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "UNSUPPORTED_OPERATION_ACTION");
  assert.equal(calls.length, 0);
}

async function testUnsupportedActionSkipPolicy() {
  const { writer, calls } = createFakeWriter();
  const orchestrator = new PlaceCommitOrchestrator(writer);

  const result = await orchestrator.execute(
    inputFixture({ operation: operationFixtureWithUnsafeAction("SKIP_POLICY") }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "UNSUPPORTED_OPERATION_ACTION");
  assert.equal(calls.length, 0);
}

async function testUnsupportedActionFail() {
  const { writer, calls } = createFakeWriter();
  const orchestrator = new PlaceCommitOrchestrator(writer);

  const result = await orchestrator.execute(
    inputFixture({ operation: operationFixtureWithUnsafeAction("FAIL") }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "UNSUPPORTED_OPERATION_ACTION");
  assert.equal(calls.length, 0);
}

async function testMissingCategoryCreatesPlaceWithWarning() {
  const { writer, calls } = createFakeWriter();
  const orchestrator = new PlaceCommitOrchestrator(writer);

  const result = await orchestrator.execute(
    inputFixture({ context: contextFixture({ category: null }) }),
  );

  assert.equal(result.ok, true);
  assert.ok(result.draft);
  assert.ok(!("category" in result.draft));
  assert.ok(result.warnings?.some((warning) => warning.code === "CATEGORY_MISSING_REQUIRES_REVIEW"));
  assert.equal(calls.length, 1, "writer must still be called when only category is missing");
}

async function testBlockedDraftNeverCallsWriter() {
  const { writer, calls } = createFakeWriter();
  const orchestrator = new PlaceCommitOrchestrator(writer);

  const result = await orchestrator.execute(
    inputFixture({ context: contextFixture({ createdByUserId: "" }) }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "PLACE_CREATE_BLOCKED");
  assert.ok(result.blockReasons && result.blockReasons.length > 0);
  assert.ok(result.blockReasons?.some((reason) => reason.code === "MISSING_CREATED_BY"));
  assert.equal(calls.length, 0, "writer must never be called when the draft is blocked");
}

async function testWriterThrowsBecomesTypedFailureNotThrow() {
  const { writer } = createFakeWriter({ throwError: new Error("db unavailable") });
  const orchestrator = new PlaceCommitOrchestrator(writer);

  const result = await orchestrator.execute(inputFixture());

  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, "PLACE_CREATE_FAILED");
  assert.equal(result.error?.message, "db unavailable");
}

async function main() {
  await testHappyPathCreatesPlace();
  await testUnsupportedTargetTypeArticle();
  await testUnsupportedActionUpdate();
  await testUnsupportedActionSkipUnchanged();
  await testUnsupportedActionSkipPolicy();
  await testUnsupportedActionFail();
  await testMissingCategoryCreatesPlaceWithWarning();
  await testBlockedDraftNeverCallsWriter();
  await testWriterThrowsBecomesTypedFailureNotThrow();
}

main()
  .then(() => {
    console.log("PlaceCommitOrchestrator tests: OK");
  })
  .catch((error) => {
    console.error("PlaceCommitOrchestrator tests: FAILED", error);
    process.exitCode = 1;
  });
