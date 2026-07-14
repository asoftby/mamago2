import assert from "node:assert/strict";

import type { RouteStopMediaSyncerLike } from "../commit/route/RouteCommitRunner";
import type { NormalizedRouteCandidate } from "../commit/route/buildRouteCreateDraft";
import type { MigrationWarning } from "../types";
import { MEDIA_POLICIES } from "./MigrationProfile";
import { MediaPolicyGatedRouteStopMediaSyncer } from "./MediaPolicyGatedRouteStopMediaSyncer";

function candidate(mediaIds: readonly number[] = [10, 11]): NormalizedRouteCandidate {
  return {
    title: "Family Route",
    slug: "family-route",
    status: "publish",
    publishedAt: "2026-01-01 00:00:00",
    modifiedAt: "2026-01-02 00:00:00",
    stops: [{ index: 1, title: "First", description: null, imageAttachmentIds: mediaIds, placeId: null }],
    locationRaw: null,
    location: null,
    media: { featuredAttachmentId: null },
    seo: { title: null, focusKeyword: null },
    sourceTerms: [],
    rawMeta: {},
  };
}

function baseInput(candidateValue: NormalizedRouteCandidate) {
  return {
    routeId: "route-1",
    candidate: candidateValue,
    mediaOwnerUserId: "owner-1",
    sourceId: "source-1",
    sourceHash: "hash-1",
    sourceRecordKey: "wordpress-db:routes:701",
  };
}

function countingInner(warnings: MigrationWarning[]): {
  inner: RouteStopMediaSyncerLike;
  callCount: () => number;
} {
  let calls = 0;
  const inner: RouteStopMediaSyncerLike = {
    async sync() {
      calls += 1;
      return { warnings };
    },
  };
  return { inner, callCount: () => calls };
}

async function testFullDelegatesToInnerSyncer() {
  const { inner, callCount } = countingInner([{ code: "INNER_CALLED", message: "inner ran", severity: "INFO" }]);
  const gated = new MediaPolicyGatedRouteStopMediaSyncer({ inner, mediaPolicy: MEDIA_POLICIES.FULL });
  const result = await gated.sync(baseInput(candidate()));
  assert.equal(callCount(), 1);
  assert.equal(result.warnings[0]?.code, "INNER_CALLED");
}

async function testMetadataReportsEvidenceWithoutCallingInner() {
  const { inner, callCount } = countingInner([]);
  const gated = new MediaPolicyGatedRouteStopMediaSyncer({ inner, mediaPolicy: MEDIA_POLICIES.METADATA });
  const result = await gated.sync(baseInput(candidate()));
  assert.equal(callCount(), 0);
  assert.equal(result.warnings[0]?.code, "ROUTE_STOP_MEDIA_POLICY_METADATA_SKIPPED");
  assert.deepEqual(result.warnings[0]?.details?.stops, [{ sourceStopIndex: 1, attachmentIds: [10, 11] }]);
}

async function testMetadataWithNoMediaReportsNoEvidence() {
  const { inner, callCount } = countingInner([]);
  const gated = new MediaPolicyGatedRouteStopMediaSyncer({ inner, mediaPolicy: MEDIA_POLICIES.METADATA });
  const result = await gated.sync(baseInput(candidate([])));
  assert.equal(callCount(), 0);
  assert.deepEqual(result.warnings, []);
}

async function testNoneFullySkips() {
  const { inner, callCount } = countingInner([{ code: "INNER_CALLED", message: "inner ran", severity: "INFO" }]);
  const gated = new MediaPolicyGatedRouteStopMediaSyncer({ inner, mediaPolicy: MEDIA_POLICIES.NONE });
  const result = await gated.sync(baseInput(candidate()));
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
    console.log("media policy gated route stop media syncer tests: OK");
  })
  .catch((error) => {
    console.error("media policy gated route stop media syncer tests: FAILED", error);
    process.exitCode = 1;
  });
