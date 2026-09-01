import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const createRoute = source("src/app/api/business/events/route.ts");
const submitRoute = source("src/app/api/business/events/[id]/submit/route.ts");
const editorPage = source("src/app/(content-editor)/editor/event/new/page.tsx");
const migration = source(
  "prisma/migrations/20260901170000_sync_verified_business_owner_roles/migration.sql",
);

assert.equal(
  createRoute.includes("canCreateBusinessContent"),
  false,
  "Event create/list route must not use the legacy role-only authorization gate",
);
assert.match(createRoute, /checkUserBusinessPermission/);
assert.match(createRoute, /"content\.create"/);
assert.match(createRoute, /BUSINESS_NOT_APPROVED/);
assert.match(createRoute, /BUSINESS_CONTENT_CREATE_FORBIDDEN/);

assert.equal(
  submitRoute.includes("canCreateBusinessContent"),
  false,
  "Event submit route must not use the legacy role-only authorization gate",
);
assert.match(submitRoute, /resolveCanonicalActivityBusinessId/);
assert.match(submitRoute, /"content\.publish"/);
assert.match(submitRoute, /BUSINESS_NOT_APPROVED/);
assert.match(submitRoute, /BUSINESS_CONTENT_PUBLISH_FORBIDDEN/);

assert.match(editorPage, /getPartnerCabinetBusiness/);
assert.equal(
  editorPage.includes("where: { ownerUserId: user.id }"),
  false,
  "Event editor must resolve OWNER/MANAGER membership, not only Business.ownerUserId",
);
assert.match(editorPage, /verificationStatus !== "APPROVED"/);

assert.match(migration, /'MANAGER'::"BusinessMemberRole"/);
assert.match(migration, /BusinessMember_syncPlatformRole/);
assert.match(migration, /verificationStatus/);

console.log("business event authorization wiring: OK");
