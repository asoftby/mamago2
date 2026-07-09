/**
 * Tests for the media-policy gate wrapped around EventMediaSyncer.
 * Run: tsx src/lib/migration/runtime/MediaPolicyGatedEventMediaSyncer.test.ts (assert-based, project convention).
 */

import assert from "node:assert/strict";

import type { EventMediaSyncerLike } from "../commit/event/EventCommitRunner";
import type { NormalizedEventCandidate } from "../commit/event/types";
import type { MigrationWarning } from "../types";
import { MEDIA_POLICIES } from "./MigrationProfile";
import { MediaPolicyGatedEventMediaSyncer } from "./MediaPolicyGatedEventMediaSyncer";

function baseInput(media: NormalizedEventCandidate["media"]) {
  return {
    activityId: "activity-1",
    candidate: { media } as NormalizedEventCandidate,
    ownerUserId: "owner-1",
    sourceId: "wordpress-db",
    sourceHash: "hash-1",
    sourceRecordKey: "event:1",
  };
}

const media = { featuredAttachmentId: 42, galleryAttachmentIds: [7, 8] };

function countingInner(warnings: MigrationWarning[]): {
  inner: EventMediaSyncerLike;
  callCount: () => number;
} {
  let calls = 0;
  const inner: EventMediaSyncerLike = {
    async sync() {
      calls += 1;
      return { warnings };
    },
  };
  return { inner, callCount: () => calls };
}

async function testFullDelegatesToInnerSyncer() {
  const { inner, callCount } = countingInner([{ code: "INNER_CALLED", message: "inner ran", severity: "INFO" }]);
  const gated = new MediaPolicyGatedEventMediaSyncer({ inner, mediaPolicy: MEDIA_POLICIES.FULL });
  const result = await gated.sync(baseInput(media));
  assert.equal(callCount(), 1);
  assert.equal(result.warnings[0]?.code, "INNER_CALLED");
}

async function testMetadataReportsEvidenceWithoutCallingInner() {
  const { inner, callCount } = countingInner([]);
  const gated = new MediaPolicyGatedEventMediaSyncer({ inner, mediaPolicy: MEDIA_POLICIES.METADATA });
  const result = await gated.sync(baseInput(media));
  assert.equal(callCount(), 0);
  const codes = result.warnings.map((w) => w.code);
  assert.ok(codes.includes("EVENT_MEDIA_POLICY_METADATA_COVER_SKIPPED"));
  assert.ok(codes.includes("EVENT_MEDIA_POLICY_METADATA_GALLERY_SKIPPED"));
}

async function testMetadataWithNoMediaReportsNoEvidence() {
  const { inner, callCount } = countingInner([]);
  const gated = new MediaPolicyGatedEventMediaSyncer({ inner, mediaPolicy: MEDIA_POLICIES.METADATA });
  const result = await gated.sync(baseInput(undefined));
  assert.equal(callCount(), 0);
  assert.deepEqual(result.warnings, []);
}

async function testNoneFullySkips() {
  const { inner, callCount } = countingInner([{ code: "INNER_CALLED", message: "inner ran", severity: "INFO" }]);
  const gated = new MediaPolicyGatedEventMediaSyncer({ inner, mediaPolicy: MEDIA_POLICIES.NONE });
  const result = await gated.sync(baseInput(media));
  assert.equal(callCount(), 0);
  assert.deepEqual(result.warnings, []);
}

async function main() {
  await testFullDelegatesToInnerSyncer();
  await testMetadataReportsEvidenceWithoutCallingInner();
  await testMetadataWithNoMediaReportsNoEvidence();
  await testNoneFullySkips();
}

main()
  .then(() => {
    console.log("media policy gated event media syncer tests: OK");
  })
  .catch((error) => {
    console.error("media policy gated event media syncer tests: FAILED", error);
    process.exitCode = 1;
  });
