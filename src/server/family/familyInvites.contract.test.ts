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
assert.match(read("src/lib/prisma.ts"), /PRISMA_CACHE_VERSION = "v15"/);

const svc = read("src/server/family/familyInvite.service.ts");
assert.equal((svc.match(/assertEnabled\(deps\)/g) ?? []).length, 3, "all three services are flag-gated");
assert.match(svc, /FOR UPDATE/);
assert.match(svc, /consent_required/);

// M2 has no UI/API surface yet.
import { execSync } from "node:child_process";
const users = execSync(
  "grep -rl 'familyInvite.service' src --include=*.ts --include=*.tsx || true",
  { encoding: "utf8" },
).split("\n").filter(Boolean);
for (const f of users) {
  assert.ok(/familyInvite/.test(f), `${f}: familyInvite.service must not be wired into routes/pages in M2`);
}
console.log("familyInvites.contract.test: ok");
