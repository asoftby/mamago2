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
const migration = source(
  "prisma/migrations/20260901170000_sync_verified_business_owner_roles/migration.sql",
);

assert.equal(
  eventCreateRoute.includes("canCreateBusinessContent"),
  false,
  "Event create/list route must not use the legacy role-only authorization gate",
);
assert.match(eventCreateRoute, /checkUserBusinessPermission/);
assert.match(eventCreateRoute, /"content\.create"/);
assert.match(eventCreateRoute, /BUSINESS_NOT_APPROVED/);
assert.match(eventCreateRoute, /BUSINESS_CONTENT_CREATE_FORBIDDEN/);

assert.equal(
  eventSubmitRoute.includes("canCreateBusinessContent"),
  false,
  "Event submit route must not use the legacy role-only authorization gate",
);
assert.match(eventSubmitRoute, /resolveCanonicalActivityBusinessId/);
assert.match(eventSubmitRoute, /"content\.publish"/);
assert.match(eventSubmitRoute, /BUSINESS_NOT_APPROVED/);
assert.match(eventSubmitRoute, /BUSINESS_CONTENT_PUBLISH_FORBIDDEN/);

assert.match(eventEditorPage, /getPartnerCabinetBusiness/);
assert.equal(
  eventEditorPage.includes("where: { ownerUserId: user.id }"),
  false,
  "Event editor must resolve OWNER/MANAGER membership, not only Business.ownerUserId",
);
assert.match(eventEditorPage, /verificationStatus !== "APPROVED"/);

assert.equal(
  placeSubmitRoute.includes("canCreateBusinessContent"),
  false,
  "Place submit must authorize the resource/business, not a coarse platform role",
);
assert.match(placeSubmitRoute, /"content\.publish"/);
assert.match(placeSubmitRoute, /BUSINESS_NOT_APPROVED/);
assert.match(placeSubmitRoute, /PLACE_NOT_LINKED_TO_BUSINESS/);

assert.equal(
  offerRoute.includes("canCreateBusinessContent"),
  false,
  "Offer create/list must not use the legacy role-only authorization gate",
);
assert.match(offerRoute, /"content\.publish"/);
assert.match(offerRoute, /BUSINESS_NOT_APPROVED/);
assert.match(offerRoute, /PLACE_NOT_LINKED_TO_BUSINESS/);

assert.match(migration, /'MANAGER'::"BusinessMemberRole"/);
assert.match(migration, /BusinessMember_syncPlatformRole/);
assert.match(migration, /verificationStatus/);

console.log("business content authorization wiring: OK");
