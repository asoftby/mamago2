import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const sql = read("prisma/migrations/20261006120000_family_invites_consents/migration.sql");
const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
assert.doesNotMatch(code, /^\s*(DROP |DELETE FROM|UPDATE "|TRUNCATE)/m, "migration is additive only");
for (const m of code.matchAll(/ALTER TABLE "(\w+)"/g)) {
  assert.ok(["FamilyInvite", "ConsentRecord"].includes(m[1]), `unexpected ALTER TABLE ${m[1]}`);
}
assert.match(sql, /CREATE UNIQUE INDEX "FamilyInvite_tokenHash_key"/);
assert.doesNotMatch(sql, /"token"\s+TEXT/, "raw token must never be stored");

const schema = read("prisma/schema.prisma");
assert.match(schema, /model FamilyInvite \{/);
assert.match(schema, /model ConsentRecord \{/);
assert.match(read("src/lib/prisma.ts"), /PRISMA_CACHE_VERSION = "v\d+"/);

const svc = read("src/server/family/familyInvite.service.ts");
assert.equal((svc.match(/assertEnabled\(deps\)/g) ?? []).length, 3, "all three services are flag-gated");
assert.match(svc, /FOR UPDATE/);
assert.match(svc, /consent_required/);

// M5a wires the services into /api/family/* only (routes below are the sole consumers).
import { execSync } from "node:child_process";
const users = execSync(
  "grep -rlE 'familyInvite(Delivery)?\\.service' src --include=*.ts --include=*.tsx || true",
  { encoding: "utf8" },
).split("\n").filter(Boolean);
for (const f of users) {
  assert.ok(
    /familyInvite|familyMembers|src\/app\/api\/family\//.test(f),
    `${f}: invite services may only be used by family code and /api/family routes`,
  );
}
console.log("familyInvites.contract.test: ok");

// M3b: merge is explicit, never automatic.
const merge = read("src/server/family/familyMerge.service.ts");
assert.match(merge, /validateMergeDecision/);
assert.match(merge, /consent_required/);
const invite = read("src/server/family/familyInvite.service.ts");
assert.match(invite, /!input\.merge\) throw new FamilyInviteError\("needs_merge"\)/);
console.log("familyInvites.contract (M3b): ok");
