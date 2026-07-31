import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  assertRemoteAccessAllowed,
  createWordPressSshMysqlExecutor,
  readWordPressDbConfigFromEnv,
} from "../src/lib/migration/adapters/wordpress-db/connectExecutor";
import { fetchPublishedOfferEnvelopeBySourceRecordKey } from "../src/lib/migration/adapters/wordpress-db/wordpressDbAdapter";
import type { PhoenixReleaseManifest } from "../src/lib/migration/release/types";
import { loadPhoenixReleaseManifest } from "../src/lib/migration/release/manifest";

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
  if (keys.length !== 63) throw new Error(`EXPECTED_SCOPE_MISMATCH: expected 63 keys, found ${keys.length}.`);
  if (new Set(keys).size !== keys.length) throw new Error("EXPECTED_SCOPE_DUPLICATE: duplicate Offer sourceRecordKey.");
  for (const key of keys) {
    if (!/^wordpress-db:(hb-programs|services):[1-9]\d*$/.test(key)) {
      throw new Error(`INVALID_OFFER_SOURCE_KEY: ${key}`);
    }
  }
  return keys;
}

async function main(): Promise<void> {
  const manifestPath = resolve(arg("--manifest"));
  const outPath = resolve(arg("--out"));
  const { manifest, manifestHash } = loadPhoenixReleaseManifest(manifestPath);
  const expectedKeys = offerKeys(manifest);
  const config = readWordPressDbConfigFromEnv(process.env);
  assertRemoteAccessAllowed(config, process.argv.includes("--allow-remote-readonly"));
  const executor = createWordPressSshMysqlExecutor(config);
  const envelopes = [];
  for (const sourceRecordKey of expectedKeys) {
    envelopes.push(await fetchPublishedOfferEnvelopeBySourceRecordKey(executor, sourceRecordKey));
  }
  const returnedKeys = envelopes.map((record) => record.sourceRecordKey);
  const returned = new Set(returnedKeys);
  const expected = new Set(expectedKeys);
  const missing = expectedKeys.filter((key) => !returned.has(key));
  const extra = returnedKeys.filter((key) => !expected.has(key));
  const duplicates = returnedKeys.filter((key, index) => returnedKeys.indexOf(key) !== index);
  if (missing.length || extra.length || duplicates.length || returnedKeys.length !== expectedKeys.length) {
    throw new Error(`CAPTURE_SCOPE_MISMATCH: ${JSON.stringify({ missing, extra, duplicates, returned: returnedKeys.length })}`);
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify({ schemaVersion: 1, manifestPath, manifestHash, records: envelopes }, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ expected: expectedKeys.length, returned: returnedKeys.length, missing, extra, duplicates, outPath }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
