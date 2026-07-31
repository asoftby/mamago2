import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  assertRemoteAccessAllowed,
  createWordPressSshMysqlExecutor,
  readWordPressDbConfigFromEnv,
} from "../src/lib/migration/adapters/wordpress-db/connectExecutor";
import {
  fetchPublishedArticleEnvelopeBySourceRecordKey,
  fetchPublishedEventEnvelopeBySourceRecordKey,
  fetchPublishedOfferEnvelopeBySourceRecordKey,
  fetchPublishedRouteEnvelopeBySourceRecordKey,
} from "../src/lib/migration/adapters/wordpress-db/wordpressDbAdapter";
import type { PhoenixReleaseManifest } from "../src/lib/migration/release/types";
import { loadPhoenixReleaseManifest } from "../src/lib/migration/release/manifest";
import type { SourceRecordEnvelope } from "../src/lib/migration/types";

/**
 * One bounded, read-only WordPress source session capturing raw content for
 * all four remaining Phoenix entities (Offers, Routes, Events, Articles) in
 * a single executor/SSH connection — no reconnecting per entity.
 *
 * Scope authority:
 * - Offers: the committed release manifest's `offers` phase (63 keys,
 *   already frozen from PR #101 — same as `capture-phoenix-offers-source.ts`).
 * - Routes/Events/Articles: the exact set of `sourceRecordKey`s already
 *   present as active `MigrationLineage` rows locally (targetType
 *   ROUTE/ACTIVITY/ARTICLE) — this *is* the already-approved, already-
 *   reviewed LOCAL migration scope per docs/migration/prelaunch-checklist.md
 *   (Routes 14/14, Events 10 total lineage, Articles 26 cumulative across
 *   two batches). No new scope is invented here; these lists were read
 *   directly from the LOCAL database, not guessed.
 *
 * `wordpress-db:events:64159` is deliberately excluded from the Events
 * capture: the checklist records an explicit, still-open "founder
 * disposition for expired source 64159" — this record's fate is undecided,
 * so it is not part of this release's executable scope (matches the
 * established EXCLUDE_FROM_FIRST_RELEASE pattern already used for Users).
 *
 * `wordpress-db:events:55980` is also excluded: a live read-only check
 * (2026-07-31) found its WordPress `post_status` has since transitioned to
 * `expired` (same lifecycle state as 64159, just not previously flagged in
 * the checklist), so `fetchPublishedEventEnvelopeBySourceRecordKey` — which
 * only accepts `post_status=publish` — can no longer retrieve it. This is a
 * backlog item, not a scope decision or a reason to loosen the fetcher's
 * status filter: 8 of the original 10 Events lineage rows are still
 * `publish` and captured below.
 *
 * Raw envelopes (title/content/etc.) are written OUTSIDE git, mode 0600,
 * per prelaunch-checklist.md rule 14 — never committed. Only a minimal
 * scope+checksum artifact (sourceRecordKey + canonical hash, no content) is
 * meant to be committed, built separately from this script's output.
 */

const ROUTE_SOURCE_RECORD_KEYS: readonly string[] = [
  "wordpress-db:routes:17822",
  "wordpress-db:routes:18437",
  "wordpress-db:routes:19413",
  "wordpress-db:routes:22133",
  "wordpress-db:routes:24298",
  "wordpress-db:routes:24917",
  "wordpress-db:routes:25888",
  "wordpress-db:routes:29290",
  "wordpress-db:routes:32543",
  "wordpress-db:routes:34581",
  "wordpress-db:routes:46963",
  "wordpress-db:routes:47932",
  "wordpress-db:routes:48687",
  "wordpress-db:routes:51442",
];

const EVENT_SOURCE_RECORD_KEYS: readonly string[] = [
  // wordpress-db:events:55980 excluded — expired in the live WP source (backlog).
  "wordpress-db:events:56062",
  "wordpress-db:events:56226",
  "wordpress-db:events:56479",
  "wordpress-db:events:60404",
  "wordpress-db:events:62977",
  "wordpress-db:events:63510",
  // wordpress-db:events:64159 excluded — founder disposition pending (expired source).
  "wordpress-db:events:64251",
  "wordpress-db:events:64505",
];

const ARTICLE_SOURCE_RECORD_KEYS: readonly string[] = [
  "wordpress-db:post:24695",
  "wordpress-db:post:24772",
  "wordpress-db:post:24774",
  "wordpress-db:post:24988",
  "wordpress-db:post:26068",
  "wordpress-db:post:26605",
  "wordpress-db:post:27355",
  "wordpress-db:post:28546",
  "wordpress-db:post:30049",
  "wordpress-db:post:30593",
  "wordpress-db:post:30642",
  "wordpress-db:post:30700",
  "wordpress-db:post:31021",
  "wordpress-db:post:32082",
  "wordpress-db:post:32217",
  "wordpress-db:post:33172",
  "wordpress-db:post:33899",
  "wordpress-db:post:34363",
  "wordpress-db:post:34997",
  "wordpress-db:post:35329",
  "wordpress-db:post:37026",
  "wordpress-db:post:39844",
  "wordpress-db:post:40724",
  "wordpress-db:post:56250",
  "wordpress-db:post:57731",
  "wordpress-db:post:9704",
];

function arg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value) throw new Error(`Missing ${name} <value>.`);
  return value;
}

function offerKeys(manifest: PhoenixReleaseManifest): string[] {
  const phase = manifest.phases.find((candidate) => candidate.name === "offers");
  if (!phase) throw new Error("The Phoenix release manifest has no offers phase.");
  const keys = phase.records.map((record) => record.sourceRecordKey);
  if (keys.length !== 63) throw new Error(`EXPECTED_SCOPE_MISMATCH:offers: expected 63 keys, found ${keys.length}.`);
  if (new Set(keys).size !== keys.length) throw new Error("EXPECTED_SCOPE_DUPLICATE:offers.");
  return keys;
}

async function captureEntity(input: {
  label: string;
  expectedKeys: readonly string[];
  fetchOne: (sourceRecordKey: string) => Promise<SourceRecordEnvelope>;
  outPath: string;
}): Promise<{ label: string; expected: number; returned: number; missing: string[]; extra: string[]; duplicates: string[]; outPath: string }> {
  const envelopes: SourceRecordEnvelope[] = [];
  for (const sourceRecordKey of input.expectedKeys) {
    envelopes.push(await input.fetchOne(sourceRecordKey));
  }
  const returnedKeys = envelopes.map((record) => record.sourceRecordKey);
  const returned = new Set(returnedKeys);
  const expected = new Set(input.expectedKeys);
  const missing = input.expectedKeys.filter((key) => !returned.has(key));
  const extra = returnedKeys.filter((key) => !expected.has(key));
  const duplicates = returnedKeys.filter((key, index) => returnedKeys.indexOf(key) !== index);
  if (missing.length || extra.length || duplicates.length || returnedKeys.length !== input.expectedKeys.length) {
    throw new Error(`CAPTURE_SCOPE_MISMATCH:${input.label}: ${JSON.stringify({ missing, extra, duplicates, returned: returnedKeys.length })}`);
  }
  mkdirSync(dirname(input.outPath), { recursive: true });
  writeFileSync(
    input.outPath,
    `${JSON.stringify({ schemaVersion: 1, entity: input.label, capturedAt: new Date().toISOString(), records: envelopes }, null, 2)}\n`,
    { mode: 0o600 },
  );
  return { label: input.label, expected: input.expectedKeys.length, returned: returnedKeys.length, missing, extra, duplicates, outPath: input.outPath };
}

async function main(): Promise<void> {
  const manifestPath = resolve(arg("--manifest"));
  const outDir = resolve(arg("--out-dir"));
  const { manifest } = loadPhoenixReleaseManifest(manifestPath);
  const expectedOfferKeys = offerKeys(manifest);

  const config = readWordPressDbConfigFromEnv(process.env);
  assertRemoteAccessAllowed(config, process.argv.includes("--allow-remote-readonly"));
  const executor = createWordPressSshMysqlExecutor(config);

  const results = [];
  results.push(await captureEntity({
    label: "offers",
    expectedKeys: expectedOfferKeys,
    fetchOne: (key) => fetchPublishedOfferEnvelopeBySourceRecordKey(executor, key),
    outPath: resolve(outDir, "offers", "capture.json"),
  }));
  results.push(await captureEntity({
    label: "routes",
    expectedKeys: ROUTE_SOURCE_RECORD_KEYS,
    fetchOne: (key) => fetchPublishedRouteEnvelopeBySourceRecordKey(executor, key),
    outPath: resolve(outDir, "routes", "capture.json"),
  }));
  results.push(await captureEntity({
    label: "events",
    expectedKeys: EVENT_SOURCE_RECORD_KEYS,
    fetchOne: (key) => fetchPublishedEventEnvelopeBySourceRecordKey(executor, key),
    outPath: resolve(outDir, "events", "capture.json"),
  }));
  results.push(await captureEntity({
    label: "articles",
    expectedKeys: ARTICLE_SOURCE_RECORD_KEYS,
    fetchOne: (key) => fetchPublishedArticleEnvelopeBySourceRecordKey(executor, key),
    outPath: resolve(outDir, "articles", "capture.json"),
  }));

  console.log(JSON.stringify(results, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
