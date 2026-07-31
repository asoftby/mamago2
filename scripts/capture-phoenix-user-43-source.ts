import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertRemoteAccessAllowed,
  createWordPressSshMysqlExecutor,
  readWordPressDbConfigFromEnv,
} from "../src/lib/migration/adapters/wordpress-db/connectExecutor";

/**
 * One bounded, read-only, single-key WordPress capture for
 * `wordpress-db:user:43` — reincluded into the Phoenix Users scope by
 * explicit founder decision 2026-07-31
 * (`WP_USER_43_REINCLUDED_FOR_CONTENT_OWNERSHIP`; see
 * `docs/migration/phoenix-places-owner-scope-gap-2026-07-31.md`). This
 * exact record was deliberately never captured into `users/capture.json`
 * originally (it was one of the 5 founder-excluded keys at capture time),
 * so this appends it rather than re-running the full 559-record capture.
 * Same field set as `capture-phoenix-users-places-source.ts`'s Users
 * query — no PII beyond what that script already reads.
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

const SOURCE_RECORD_KEY = "wordpress-db:user:43";
const LEGACY_USER_ID = 43;

async function main(): Promise<void> {
  const captureDir = resolve(arg("--artifact-root"));
  const capturePath = resolve(captureDir, "users", "capture.json");

  const existing = JSON.parse(readFileSync(capturePath, "utf8")) as {
    schemaVersion: number;
    entity: string;
    records: Array<{ sourceRecordKey: string }>;
  };
  if (existing.records.some((r) => r.sourceRecordKey === SOURCE_RECORD_KEY)) {
    throw new Error(`ALREADY_CAPTURED: ${SOURCE_RECORD_KEY} is already present in ${capturePath}.`);
  }
  if (existing.records.length !== 559) {
    throw new Error(`UNEXPECTED_BASE_CAPTURE_SIZE: expected 559 existing records, found ${existing.records.length}.`);
  }

  const config = readWordPressDbConfigFromEnv(process.env);
  assertRemoteAccessAllowed(config, process.argv.includes("--allow-remote-readonly"));
  const executor = createWordPressSshMysqlExecutor(config);

  const rows = await executor<RawUserRow>(
    `SELECT u.ID, u.user_email, u.display_name, u.user_registered,
      (SELECT meta_value FROM wp_usermeta WHERE user_id = u.ID AND meta_key = 'first_name' LIMIT 1) AS first_name,
      (SELECT meta_value FROM wp_usermeta WHERE user_id = u.ID AND meta_key = 'last_name' LIMIT 1) AS last_name,
      (SELECT meta_value FROM wp_usermeta WHERE user_id = u.ID AND meta_key = 'wp_capabilities' LIMIT 1) AS capabilities
     FROM wp_users u WHERE u.ID = ${LEGACY_USER_ID};`,
  );
  if (rows.length !== 1) throw new Error(`CAPTURE_SCOPE_MISMATCH: expected exactly 1 row for user ${LEGACY_USER_ID}, found ${rows.length}.`);
  const row = rows[0];
  if ((row.capabilities ?? "").includes("administrator")) {
    throw new Error(`ADMIN_CANDIDATE_IN_APPROVED_SCOPE: ${SOURCE_RECORD_KEY}`);
  }

  const newRecord = {
    sourceRecordKey: SOURCE_RECORD_KEY,
    sourceSystem: "wordpress-db" as const,
    legacyUserId: LEGACY_USER_ID,
    email: row.user_email,
    displayName: row.display_name || null,
    firstName: row.first_name || null,
    lastName: row.last_name || null,
    phone: null,
    sourceCreatedAt: row.user_registered,
    legacyRoles: [] as string[],
    legacyPasswordPresent: false,
    businessLinked: true, // wordpress-db:user:43 is an EXACT_LINK_CANDIDATE — see phoenix-business-ownership-base-2026-07-30.json
    businessEvidence: { exactOwnership: false, placeCount: 0 },
    privilegedCollision: false,
    profileMediaReferencePresent: false,
  };

  const merged = {
    schemaVersion: existing.schemaVersion,
    entity: existing.entity,
    capturedAt: new Date().toISOString(),
    records: [...existing.records, newRecord],
  };
  const raw = `${JSON.stringify(merged, null, 2)}\n`;
  writeFileSync(capturePath, raw, { mode: 0o600 });
  const sha256 = createHash("sha256").update(raw).digest("hex");

  console.log(JSON.stringify({ capturePath, totalRecords: merged.records.length, addedSourceRecordKey: SOURCE_RECORD_KEY, sha256, hasDisplayName: Boolean(row.display_name) }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
