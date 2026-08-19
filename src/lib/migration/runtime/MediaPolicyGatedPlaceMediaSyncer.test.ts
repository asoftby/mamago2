/**
 * Tests for the media-policy gate wrapped around PlaceMediaSyncer, plus its
 * real integration with `resolveSampledMediaPolicy()` (PR #46's sampled
 * media policy, which already carries a 3-Place LOCAL/DEV allowlist).
 * Run: tsx src/lib/migration/runtime/MediaPolicyGatedPlaceMediaSyncer.test.ts
 */

import assert from "node:assert/strict";

import type { PlaceMediaSyncerLike } from "../commit/place/PlaceCommitRunner";
import type { PlaceMediaSyncResult } from "../commit/place/PlaceMediaSyncer";
import type { NormalizedPlaceCandidate } from "../commit/place/types";
import { resolveSampledMediaPolicy } from "./sampledMediaPolicy";
import { MEDIA_POLICIES } from "./MigrationProfile";
import { MediaPolicyGatedPlaceMediaSyncer } from "./MediaPolicyGatedPlaceMediaSyncer";

const ZERO_COUNTS = { imported: 0, reused: 0, skipped: 0, failed: 0 };

function baseInput(media: NormalizedPlaceCandidate["media"], sourceRecordKey = "wordpress-db:places:1") {
  return {
    placeId: "place-1",
    candidate: { media } as NormalizedPlaceCandidate,
    uploadedByUserId: "user-1",
    sourceId: "wordpress-db",
    sourceHash: "hash-1",
    sourceRecordKey,
  };
}

const media = { thumbnailAttachmentId: 42, galleryAttachmentIds: [7, 8] };

function countingInner(result: Partial<PlaceMediaSyncResult> = {}): {
  inner: PlaceMediaSyncerLike;
  callCount: () => number;
} {
  let calls = 0;
  const inner: PlaceMediaSyncerLike = {
    async sync() {
      calls += 1;
      return { warnings: [], ...ZERO_COUNTS, ...result };
    },
  };
  return { inner, callCount: () => calls };
}

async function testFullDelegatesToInnerSyncer() {
  const { inner, callCount } = countingInner({ warnings: [{ code: "INNER_CALLED", message: "inner ran", severity: "INFO" }] });
  const gated = new MediaPolicyGatedPlaceMediaSyncer({ inner, mediaPolicy: MEDIA_POLICIES.FULL });
  const result = await gated.sync(baseInput(media));
  assert.equal(callCount(), 1);
  assert.equal(result.warnings[0]?.code, "INNER_CALLED");
}

async function testMetadataReportsEvidenceWithoutCallingInner() {
  const { inner, callCount } = countingInner();
  const gated = new MediaPolicyGatedPlaceMediaSyncer({ inner, mediaPolicy: MEDIA_POLICIES.METADATA });
  const result = await gated.sync(baseInput(media));
  assert.equal(callCount(), 0, "METADATA must never call the inner syncer — no download");
  assert.deepEqual({ imported: result.imported, reused: result.reused, skipped: result.skipped, failed: result.failed }, ZERO_COUNTS);
  const codes = result.warnings.map((w) => w.code);
  assert.ok(codes.includes("PLACE_MEDIA_POLICY_METADATA_COVER_SKIPPED"));
  assert.ok(codes.includes("PLACE_MEDIA_POLICY_METADATA_GALLERY_SKIPPED"));
}

async function testMetadataWithNoMediaReportsNoEvidence() {
  const { inner, callCount } = countingInner();
  const gated = new MediaPolicyGatedPlaceMediaSyncer({ inner, mediaPolicy: MEDIA_POLICIES.METADATA });
  const result = await gated.sync(baseInput({ thumbnailAttachmentId: null, galleryAttachmentIds: [] }));
  assert.equal(callCount(), 0);
  assert.deepEqual(result.warnings, []);
}

async function testNoneFullySkips() {
  const { inner, callCount } = countingInner({ warnings: [{ code: "INNER_CALLED", message: "inner ran", severity: "INFO" }] });
  const gated = new MediaPolicyGatedPlaceMediaSyncer({ inner, mediaPolicy: MEDIA_POLICIES.NONE });
  const result = await gated.sync(baseInput(media));
  assert.equal(callCount(), 0);
  assert.deepEqual(result.warnings, []);
}

async function testResolverReturningMetadataWithReasonUsesSampleSkippedCode() {
  const { inner, callCount } = countingInner();
  const gated = new MediaPolicyGatedPlaceMediaSyncer({
    inner,
    mediaPolicy: () => ({ policy: MEDIA_POLICIES.METADATA, reason: "SKIPPED_BY_MEDIA_SAMPLE_POLICY" }),
  });
  const result = await gated.sync(baseInput(media));
  assert.equal(callCount(), 0, "sampling-skipped records must never call the inner syncer — no download");

  const sampleWarning = result.warnings.find((w) => w.code === "PLACE_MEDIA_SAMPLE_SKIPPED");
  assert.ok(sampleWarning, "the sample-skip reason must be surfaced under the PLACE_MEDIA_SAMPLE_SKIPPED code");
  assert.equal(sampleWarning?.severity, "INFO");
}

// ---------------------------------------------------------------------------
// Real integration with resolveSampledMediaPolicy() (PR #46).
// ---------------------------------------------------------------------------

async function testAllowlistedLocalDevGetsFull() {
  const { inner, callCount } = countingInner();
  const gated = new MediaPolicyGatedPlaceMediaSyncer({
    inner,
    mediaPolicy: (sourceRecordKey: string) => resolveSampledMediaPolicy({ environment: "LOCAL", sourceRecordKey }),
  });
  const result = await gated.sync(baseInput(media, "wordpress-db:places:5389"));
  assert.equal(callCount(), 1, "an allowlisted Place must get FULL and reach the real downloader");
  assert.equal(result.warnings.length, 0);
}

async function testNonAllowlistedLocalDevGetsMetadataAndNeverCallsDownloader() {
  const { inner, callCount } = countingInner();
  const gated = new MediaPolicyGatedPlaceMediaSyncer({
    inner,
    mediaPolicy: (sourceRecordKey: string) => resolveSampledMediaPolicy({ environment: "DEV", sourceRecordKey }),
  });
  const result = await gated.sync(baseInput(media, "wordpress-db:places:99999"));
  assert.equal(callCount(), 0, "a non-allowlisted Place must never reach the downloader in LOCAL/DEV");
  assert.ok(result.warnings.some((w) => w.code === "PLACE_MEDIA_SAMPLE_SKIPPED"));
}

async function testProductionGetsFullRegardlessOfAllowlist() {
  const { inner, callCount } = countingInner();
  const gated = new MediaPolicyGatedPlaceMediaSyncer({
    inner,
    mediaPolicy: (sourceRecordKey: string) => resolveSampledMediaPolicy({ environment: "PROD", sourceRecordKey }),
  });
  const result = await gated.sync(baseInput(media, "wordpress-db:places:99999"));
  assert.equal(callCount(), 1, "production is never constrained by the LOCAL/DEV sample allowlist");
  assert.equal(result.warnings.length, 0);
}

async function main() {
  await testFullDelegatesToInnerSyncer();
  await testMetadataReportsEvidenceWithoutCallingInner();
  await testMetadataWithNoMediaReportsNoEvidence();
  await testNoneFullySkips();
  await testResolverReturningMetadataWithReasonUsesSampleSkippedCode();

  await testAllowlistedLocalDevGetsFull();
  await testNonAllowlistedLocalDevGetsMetadataAndNeverCallsDownloader();
  await testProductionGetsFullRegardlessOfAllowlist();
}

main()
  .then(() => {
    console.log("MediaPolicyGatedPlaceMediaSyncer tests: OK");
  })
  .catch((error) => {
    console.error("MediaPolicyGatedPlaceMediaSyncer tests: FAILED", error);
    process.exitCode = 1;
  });
