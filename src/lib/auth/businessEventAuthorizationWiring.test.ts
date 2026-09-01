import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const eventCreateRoute = source("src/app/api/business/events/route.ts");
const eventSubmitRoute = source("src/app/api/business/events/[id]/submit/route.ts");
const eventEditorPage = source("src/app/(content-editor)/editor/event/new/page.tsx");
const placeSubmitRoute = source("src/app/api/business/places/[id]/submit/route.ts");
const offerRoute = source("src/app/api/business/offers/route.ts");
const businessPermissions = source("src/server/permissions/business-permissions.ts");
const canonicalMigration = source(
  "prisma/migrations/20260901193000_canonicalize_business_member_access/migration.sql",
);

for (const [name, text] of [
  ["event create/list", eventCreateRoute],
  ["event submit", eventSubmitRoute],
  ["place submit", placeSubmitRoute],
  ["offer create/list", offerRoute],
] as const) {
  assert.equal(
    text.includes("canCreateBusinessContent"),
    false,
    `${name} must not use the legacy role-only authorization gate`,
  );
}

assert.match(eventCreateRoute, /checkUserBusinessPermission/);
assert.match(eventCreateRoute, /"content\.create"/);
assert.match(eventCreateRoute, /BUSINESS_NOT_APPROVED/);
assert.match(eventSubmitRoute, /resolveCanonicalActivityBusinessId/);
assert.match(eventSubmitRoute, /"content\.publish"/);
assert.match(eventSubmitRoute, /BUSINESS_NOT_APPROVED/);

assert.match(eventEditorPage, /getPartnerCabinetBusiness/);
assert.equal(
  eventEditorPage.includes("where: { ownerUserId: user.id }"),
  false,
  "Event editor must resolve OWNER/MANAGER membership",
);

assert.match(placeSubmitRoute, /"content\.publish"/);
assert.match(placeSubmitRoute, /PLACE_NOT_LINKED_TO_BUSINESS/);
assert.match(offerRoute, /"content\.publish"/);
assert.match(offerRoute, /PLACE_NOT_LINKED_TO_BUSINESS/);

assert.match(businessPermissions, /permission\.startsWith\("content\."\)/);
assert.match(businessPermissions, /operationalStatus !== "ACTIVE"/);
assert.match(businessPermissions, /getBusinessMembership/);
assert.match(businessPermissions, /checkBusinessToolPermission/);
assert.equal(
  businessPermissions.includes("return getOwnedBusinessForUser(userId)"),
  false,
  "Cabinet authorization must not fall back to Business.ownerUserId",
);

assert.match(canonicalMigration, /INSERT INTO "BusinessMember"/);
assert.match(canonicalMigration, /'OWNER'::"BusinessMemberRole"/);
assert.match(canonicalMigration, /DROP TRIGGER IF EXISTS "BusinessMember_syncPlatformRole"/);
assert.match(canonicalMigration, /DROP TRIGGER IF EXISTS "Business_syncMemberPlatformRoles"/);

console.log("business content authorization wiring: OK");
