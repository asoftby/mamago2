import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  assertRemoteAccessAllowed,
  createWordPressSshMysqlExecutor,
  readWordPressDbConfigFromEnv,
} from "../src/lib/migration/adapters/wordpress-db/connectExecutor";
import { fetchPublishedPlaceEnvelopeBySourceRecordKey } from "../src/lib/migration/adapters/wordpress-db/wordpressDbAdapter";
import { loadPhoenixReleaseManifest } from "../src/lib/migration/release/manifest";

/**
 * One bounded, read-only WordPress source session capturing Users (raw
 * fields only, no classification reconstruction) and Places (via the
 * already-proven fetchPublishedPlaceEnvelopeBySourceRecordKey), for the
 * exact already-approved scope frozen in the committed release manifest —
 * no new scope invented, no A/C/D/H classification reproduced.
 *
 * Users capture deliberately does NOT read anything password/session/
 * activation-token related — WordPress never even stores a password hash
 * this pipeline would use (buildUserDraft always sets passwordHash: null,
 * role: "USER" unconditionally). Only email/name/registration-date/role-
 * capability fields are read, and role-capability is read only to verify
 * none of the 559 approved keys is an administrator (defense in depth;
 * buildUserDraft itself can never elevate role regardless).
 */

interface RawUserRow {
  ID: number;
  user_email: string;
  display_name: string;
  user_registered: string;
  first_name: string | null;
  last_name: string | null;
  capabilities: string | null;
}

function arg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value) throw new Error(`Missing ${name} <value>.`);
  return value;
}

function legacyIdFromKey(key: string, prefix: string): number {
  const match = new RegExp(`^${prefix}:(\\d+)$`).exec(key);
  if (!match) throw new Error(`Invalid sourceRecordKey for prefix ${prefix}: ${key}`);
  return Number(match[1]);
}

async function main(): Promise<void> {
  const manifestPath = resolve(arg("--manifest"));
  const outDir = resolve(arg("--out-dir"));
  const { manifest } = loadPhoenixReleaseManifest(manifestPath);

  const usersPhase = manifest.phases.find((p) => p.name === "users")!;
  const expectedUserKeys = usersPhase.records.map((r) => r.sourceRecordKey);
  if (expectedUserKeys.length !== 559) throw new Error(`EXPECTED_SCOPE_MISMATCH:users: expected 559, found ${expectedUserKeys.length}`);
  if (new Set(expectedUserKeys).size !== 559) throw new Error("EXPECTED_SCOPE_DUPLICATE:users");

  const placesPhase = manifest.phases.find((p) => p.name === "places")!;
  const expectedPlaceKeys = placesPhase.records.map((r) => r.sourceRecordKey);
  if (new Set(expectedPlaceKeys).size !== expectedPlaceKeys.length) throw new Error("EXPECTED_SCOPE_DUPLICATE:places");

  // Business-linked set: any sourceRecordKey present in the already-
  // approved committed Business ownership base/override artifacts —
  // informational only (feeds classification/hash stability), never a
  // dependency for CREATE eligibility.
  const businessBase = JSON.parse(readFileSync("docs/migration/manifests/phoenix-business-ownership-base-2026-07-30.json", "utf8")) as { entries: Array<{ sourceRecordKey: string }> };
  const businessOverrides = JSON.parse(readFileSync("docs/migration/manifests/phoenix-business-ownership-overrides-2026-07-30.json", "utf8")) as { entries: Array<{ sourceRecordKey: string }> };
  const businessLinkedKeys = new Set([...businessBase.entries, ...businessOverrides.entries].map((e) => e.sourceRecordKey));

  const config = readWordPressDbConfigFromEnv(process.env);
  assertRemoteAccessAllowed(config, process.argv.includes("--allow-remote-readonly"));
  const executor = createWordPressSshMysqlExecutor(config);

  // --- Users: one bounded SQL fetch for the exact 559 legacy IDs ---
  const legacyUserIds = expectedUserKeys.map((k) => legacyIdFromKey(k, "wordpress-db:user"));
  const idList = legacyUserIds.join(",");
  const rows = await executor<RawUserRow>(
    `SELECT u.ID, u.user_email, u.display_name, u.user_registered,
      (SELECT meta_value FROM wp_usermeta WHERE user_id = u.ID AND meta_key = 'first_name' LIMIT 1) AS first_name,
      (SELECT meta_value FROM wp_usermeta WHERE user_id = u.ID AND meta_key = 'last_name' LIMIT 1) AS last_name,
      (SELECT meta_value FROM wp_usermeta WHERE user_id = u.ID AND meta_key = 'wp_capabilities' LIMIT 1) AS capabilities
     FROM wp_users u WHERE u.ID IN (${idList});`,
  );
  const byId = new Map(rows.map((r) => [Number(r.ID), r]));
  const missingUsers = legacyUserIds.filter((id) => !byId.has(id));
  const adminUsers = rows.filter((r) => (r.capabilities ?? "").includes("administrator")).map((r) => `wordpress-db:user:${r.ID}`);
  if (missingUsers.length > 0) throw new Error(`CAPTURE_SCOPE_MISMATCH:users:missing:${JSON.stringify(missingUsers)}`);
  if (rows.length !== legacyUserIds.length) throw new Error(`CAPTURE_SCOPE_MISMATCH:users:count:${rows.length}`);
  if (adminUsers.length > 0) throw new Error(`ADMIN_CANDIDATE_IN_APPROVED_SCOPE:${JSON.stringify(adminUsers)}`);

  const userRecords = expectedUserKeys.map((sourceRecordKey) => {
    const legacyUserId = legacyIdFromKey(sourceRecordKey, "wordpress-db:user");
    const row = byId.get(legacyUserId)!;
    return {
      sourceRecordKey,
      sourceSystem: "wordpress-db" as const,
      legacyUserId,
      email: row.user_email,
      displayName: row.display_name || null,
      firstName: row.first_name || null,
      lastName: row.last_name || null,
      phone: null,
      sourceCreatedAt: row.user_registered,
      legacyRoles: [] as string[],
      legacyPasswordPresent: false,
      businessLinked: businessLinkedKeys.has(sourceRecordKey),
      businessEvidence: { exactOwnership: false, placeCount: 0 },
      privilegedCollision: false,
      profileMediaReferencePresent: false,
    };
  });
  mkdirSync(resolve(outDir, "users"), { recursive: true });
  writeFileSync(
    resolve(outDir, "users", "capture.json"),
    `${JSON.stringify({ schemaVersion: 1, entity: "users", capturedAt: new Date().toISOString(), records: userRecords }, null, 2)}\n`,
    { mode: 0o600 },
  );

  // --- Places: reuse the already-proven fetch-by-key mechanism ---
  const placeEnvelopes = [];
  for (const key of expectedPlaceKeys) placeEnvelopes.push(await fetchPublishedPlaceEnvelopeBySourceRecordKey(executor, key));
  const returnedPlaceKeys = placeEnvelopes.map((e) => e.sourceRecordKey);
  const missingPlaces = expectedPlaceKeys.filter((k) => !returnedPlaceKeys.includes(k));
  const duplicatePlaces = returnedPlaceKeys.filter((k, i) => returnedPlaceKeys.indexOf(k) !== i);
  if (missingPlaces.length || duplicatePlaces.length || returnedPlaceKeys.length !== expectedPlaceKeys.length) {
    throw new Error(`CAPTURE_SCOPE_MISMATCH:places:${JSON.stringify({ missingPlaces, duplicatePlaces, returned: returnedPlaceKeys.length })}`);
  }
  mkdirSync(resolve(outDir, "places"), { recursive: true });
  writeFileSync(
    resolve(outDir, "places", "capture.json"),
    `${JSON.stringify({ schemaVersion: 1, entity: "places", capturedAt: new Date().toISOString(), records: placeEnvelopes }, null, 2)}\n`,
    { mode: 0o600 },
  );

  console.log(JSON.stringify({
    users: { expected: expectedUserKeys.length, returned: rows.length, missing: missingUsers, adminCandidates: adminUsers.length, businessLinkedCount: userRecords.filter((r) => r.businessLinked).length },
    places: { expected: expectedPlaceKeys.length, returned: returnedPlaceKeys.length, missing: missingPlaces, duplicates: duplicatePlaces },
  }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
