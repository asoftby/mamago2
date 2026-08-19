import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import {
  classifyRedirectManifest,
  type RedirectManifestEntry,
} from "./redirectManifestClassifier";

function fakePrisma(): PrismaClient {
  return {
    city: { findMany: async () => [{ id: "minsk-id", slug: "minsk" }] },
    activity: {
      findMany: async () => [
        { id: "event-id", slug: "live-event", cityId: "minsk-id", status: "PUBLISHED", title: "Live" },
      ],
    },
    activitySlugHistory: { findMany: async () => [] },
    article: {
      findMany: async () => [
        { id: "article-id", slug: "live-article", cityId: "minsk-id", status: "PUBLISHED", title: "Live" },
      ],
    },
    articleSlugHistory: { findMany: async () => [] },
    place: { findMany: async () => [] },
    placeSlugHistory: { findMany: async () => [] },
    offer: { findMany: async () => [] },
    offerSlugHistory: { findMany: async () => [] },
  } as unknown as PrismaClient;
}

const entry = (
  source: string,
  destination: string,
  type = "article",
): RedirectManifestEntry => ({ source, destination, type, permanent: true });

const manifest = [
  entry("/exact", "/minsk/blog/live-article"),
  entry("/hub", "/minsk/events", "event-category"),
  entry("/contains", "/minsk/events", "age"),
  entry("/invalid", "/minsk/events/missing"),
  entry("/duplicate", "/minsk/blog/live-article"),
  entry("/duplicate", "/minsk/events/live-event"),
  entry("/self", "/self"),
  entry("/chain-a", "/chain-b"),
  entry("/chain-b", "/minsk/blog/live-article"),
  entry("/loop-a", "/loop-b"),
  entry("/loop-b", "/loop-a"),
];

async function main() {
  const first = await classifyRedirectManifest(fakePrisma(), manifest);
  const second = await classifyRedirectManifest(fakePrisma(), manifest);
  const bySource = new Map(first.entries.map((row) => [row.source, row.disposition]));

  assert.equal(bySource.get("/exact"), "EXACT_REDIRECT");
  assert.equal(bySource.get("/hub"), "VALID_HUB_REMAP");
  assert.equal(bySource.get("/contains"), "P1_START_OR_CONTAINS");
  assert.equal(bySource.get("/invalid"), "INVALID_TARGET");
  assert.equal(bySource.get("/duplicate"), "COLLISION");
  assert.ok(first.chains.some((problem) => problem.source === "/self" && problem.reason.includes("self-redirect")));
  assert.equal(bySource.get("/chain-a"), "CHAIN");
  assert.equal(bySource.get("/loop-a"), "LOOP");
  assert.equal(bySource.get("/loop-b"), "LOOP");
  assert.deepEqual(first.counts, second.counts, "summary must be deterministic");
  assert.deepEqual(first.entries, second.entries, "classification order and output must be deterministic");
  assert.equal(Object.values(first.counts).reduce((sum, count) => sum + count, 0), manifest.length);

  console.log("redirectManifestClassifier tests: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
