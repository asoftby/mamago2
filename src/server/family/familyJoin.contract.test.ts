import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const page = read("src/app/invite/family/page.tsx");
assert.match(page, /familyInvitesEnabled\(\)\) notFound\(\)/, "page is behind FAMILY_INVITES");
// The join form is unreachable while the consent text is not configured.
assert.ok(
  page.indexOf("familyConsentConfigured()") < page.indexOf("<FamilyJoinClient"),
  "consent configured check must precede the join form",
);
assert.match(page, /redirectTo: returnTo/, "auth returns to the invite page");
assert.doesNotMatch(page, /previewFamilyInviteMerge|prisma\.child|prisma\.planItem/, "page shows no family data before consent");

// Info before consent = inviter name only.
const join = read("src/server/family/familyJoin.service.ts");
const info = join.slice(join.indexOf("export async function getFamilyInviteInfo"), join.indexOf("export async function notifyInviterJoined"));
assert.doesNotMatch(info, /child|planItem|memberships/i, "invite info must not touch children, plan or other adults");

for (const f of ["src/app/api/family/invites/accept/route.ts", "src/app/api/family/invites/preview/route.ts"]) {
  const r = read(f);
  assert.match(r, /getCurrentUser\(\)/, `${f} requires auth`);
  assert.match(r, /familyConsentConfigured\(\)/, `${f} is closed while the consent text is missing`);
  assert.match(r, /consentVersionMatches\(/, `${f} checks the exact consent version`);
  assert.match(r, /checkActivationRateLimit/, `${f} is rate limited`);
}
const accept = read("src/app/api/family/invites/accept/route.ts").replace(/^\s*\/\/.*$/gm, "");
assert.doesNotMatch(accept, /historyAccess/, "joiner cannot choose historyAccess (default FROM_JOIN)");
assert.match(accept, /\.strict\(\)/);
assert.match(accept, /notifyInviterJoined/);

const consent = read("src/server/family/familyConsent.ts");
assert.match(consent, /FAMILY_CONSENT_TEXT_VERSION = "[^"]*"/);

const client = read("src/features/family/components/FamilyJoinClient.tsx");
assert.doesNotMatch(client, /localStorage|sessionStorage/, "token is never persisted in the browser");
assert.ok(client.indexOf("/api/family/invites/preview") < client.indexOf("preview.joinerChildren"), "merge data comes from the preview API only");
// Preview applies the same validity as accept (unarchived family, creator still a member).
const merge = read("src/server/family/familyMerge.service.ts");
const prev = merge.slice(merge.indexOf("export async function previewFamilyInviteMerge"), merge.indexOf("export async function applyJoinerMerge"));
assert.match(prev, /archivedAt/);
assert.match(prev, /createdById/);
assert.ok(prev.indexOf("leftAt: null") < prev.indexOf("prisma.child.findMany"), "validity is checked before any family data is read");
// Consent is persisted before the family's children are disclosed (not just the version echoed).
const recordAt = prev.indexOf("await recordFamilySharedDataConsent(");
assert.ok(recordAt > 0, "preview persists the consent record");
assert.ok(recordAt < prev.indexOf("prisma.child.findMany"), "consent is recorded before any child data is read");
// The consent writer serializes check-and-create (no duplicate rows under concurrency).
const consentWriter = read("src/server/family/familyConsentRecord.ts");
assert.ok(
  consentWriter.indexOf("pg_advisory_xact_lock") > 0 &&
    consentWriter.indexOf("pg_advisory_xact_lock") < consentWriter.indexOf("consentRecord.findFirst"),
  "advisory lock is taken before the existence check",
);
// FROM_JOIN is enforced by the read scope.
const access = read("src/server/family/familyAccess.ts");
const resolve_ = access.slice(access.indexOf("export async function resolveFamilyScope"), access.indexOf("export async function planScopeFor"));
assert.match(resolve_, /historyAccess: true/);
assert.match(resolve_, /sharedHistoryFromMembership\(/);
console.log("familyJoin.contract.test: ok");
