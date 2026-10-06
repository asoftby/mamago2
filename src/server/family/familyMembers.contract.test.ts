import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const svc = read("src/server/family/familyMembers.service.ts");
assert.equal((svc.match(/assertEnabled\(deps\)/g) ?? []).length, 3, "list/leave/transfer are flag-gated");
assert.match(svc, /FOR UPDATE/);
// Leave: close old membership BEFORE creating the new OWNER one (partial unique index).
assert.ok(
  svc.indexOf("data: { leftAt: now }") < svc.indexOf('role: "OWNER", historyAccess: "ALL"'),
  "old membership must be closed before the new solo membership is created",
);
// Transfer: demote the old owner BEFORE promoting the target (one active OWNER per family).
assert.ok(
  svc.indexOf('data: { role: "ADULT" }') < svc.indexOf('data: { role: "OWNER" }'),
  "demote first, then promote",
);
// Only the leaver's PRIVATE items move; FAMILY items stay.
assert.match(svc, /visibility: "PRIVATE"/);
assert.doesNotMatch(svc, /planItem\.updateMany\(/, "plan items move one by one with mapped childId");

const delivery = read("src/server/family/familyInviteDelivery.service.ts");
assert.match(delivery, /checkActivationRateLimit/);
assert.doesNotMatch(delivery, /familyInvite\.(create|update)\([^)]*email/s, "email must never be stored");
const schema = read("prisma/schema.prisma");
const inviteModel = schema.match(/model FamilyInvite \{[\s\S]*?\n\}/)?.[0] ?? "";
assert.ok(inviteModel.length > 0);
assert.doesNotMatch(inviteModel, /\bemail\b/i, "FamilyInvite must not have an email column");

// The letter is neutral: no child/plan data.
const tpl = read("src/features/email/templates/family-invite.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
assert.doesNotMatch(tpl, /child|ребён|ребен/i);
const props = tpl.match(/interface FamilyInviteTemplateProps \{[\s\S]*?\n\}/)?.[0] ?? "";
assert.doesNotMatch(props, /child|plan/i);

// Every route requires a session.
for (const f of [
  "src/app/api/family/route.ts",
  "src/app/api/family/leave/route.ts",
  "src/app/api/family/transfer-owner/route.ts",
  "src/app/api/family/invites/route.ts",
  "src/app/api/family/invites/[id]/route.ts",
]) {
  assert.match(read(f), /getCurrentUser\(\)/, `${f} requires auth`);
}
console.log("familyMembers.contract.test: ok");
