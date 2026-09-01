import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(process.cwd(), "src");
const legacyDefinition = "src/lib/auth/businessContentAccess.ts";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function isProductionSource(path: string): boolean {
  const rel = relative(process.cwd(), path);
  return (
    /\.(ts|tsx)$/.test(path) &&
    !/\.(test|spec)\.(ts|tsx)$/.test(path) &&
    !rel.includes("/__tests__/")
  );
}

const sourceFiles = walk(root).filter(isProductionSource);

function productionUsersOf(symbol: string): string[] {
  return sourceFiles
    .filter((path) => relative(process.cwd(), path) !== legacyDefinition)
    .filter((path) => readFileSync(path, "utf8").includes(symbol))
    .map((path) => relative(process.cwd(), path));
}

const legacyCreateUsers = productionUsersOf("canCreateBusinessContent");
assert.deepEqual(
  legacyCreateUsers,
  [],
  `Legacy role-only B2B create authorization remains in production code:\n${legacyCreateUsers.join("\n")}`,
);

const legacyOwnedUsers = productionUsersOf("canManageOwnedContent");
assert.deepEqual(
  legacyOwnedUsers,
  [],
  `Legacy role/creator-only B2B ownership authorization remains in production code:\n${legacyOwnedUsers.join("\n")}`,
);

const permissions = readFileSync(
  resolve(process.cwd(), "src/server/permissions/business-permissions.ts"),
  "utf8",
);
assert.equal(
  permissions.includes("business.ownerUserId === userId"),
  false,
  "Business.ownerUserId must not grant authorization",
);
assert.equal(
  permissions.includes("return getOwnedBusinessForUser(userId)"),
  false,
  "Partner cabinet must not fall back to Business.ownerUserId",
);
assert.match(permissions, /getBusinessMembership/);
assert.match(permissions, /checkBusinessToolPermission/);
assert.match(permissions, /permission\.startsWith\("content\."\)/);
assert.match(permissions, /operationalStatus !== "ACTIVE"/);

const placeAccess = readFileSync(
  resolve(process.cwd(), "src/lib/auth/placeAccess.ts"),
  "utf8",
);
assert.match(placeAccess, /checkUserBusinessPermission/);
assert.match(placeAccess, /"content\.update"/);

const verification = readFileSync(
  resolve(process.cwd(), "src/server/services/businessVerification.service.ts"),
  "utf8",
);
assert.equal(
  verification.includes('data: { role: "BUSINESS_OWNER" }'),
  false,
  "Business approval must not mutate User.role",
);
assert.equal(
  verification.includes("business.ownerUserId !== actorUserId"),
  false,
  "Verification submission must not authorize via Business.ownerUserId",
);
assert.match(
  verification,
  /requireBusinessPermission\(actor, businessId, "business\.update"\)/,
  "Verification submission must use canonical BusinessMember permission checks",
);
assert.match(verification, /businessMember\.upsert/);

const verificationSubmitRoute = readFileSync(
  resolve(process.cwd(), "src/app/api/business/verification/submit/route.ts"),
  "utf8",
);
assert.equal(
  verificationSubmitRoute.includes("ownerUserId: user.id"),
  false,
  "Verification submit route must not resolve business by ownerUserId",
);
assert.match(
  verificationSubmitRoute,
  /getPartnerCabinetBusiness\(user\.id\)/,
  "Verification submit route must resolve business through active membership",
);
assert.match(
  verificationSubmitRoute,
  /status: 403/,
  "Authenticated user without active business membership must be forbidden",
);
assert.match(
  verificationSubmitRoute,
  /nextResponseFromBusinessAccessError/,
  "Canonical business access errors must preserve their HTTP status",
);

const canonicalMigration = readFileSync(
  resolve(
    process.cwd(),
    "prisma/migrations/20260901193000_canonicalize_business_member_access/migration.sql",
  ),
  "utf8",
);
assert.match(canonicalMigration, /INSERT INTO "BusinessMember"/);
assert.match(canonicalMigration, /DROP TRIGGER IF EXISTS "BusinessMember_syncPlatformRole"/);

const finalRoleSyncCleanup = readFileSync(
  resolve(
    process.cwd(),
    "prisma/migrations/20260901203000_drop_legacy_business_role_sync/migration.sql",
  ),
  "utf8",
);
for (const expected of [
  'DROP TRIGGER IF EXISTS "BusinessMember_syncPlatformRole" ON "BusinessMember"',
  'DROP FUNCTION IF EXISTS "syncBusinessMemberPlatformRole"()',
  'DROP TRIGGER IF EXISTS "Business_syncApprovedPlatformRoles" ON "Business"',
  'DROP FUNCTION IF EXISTS "syncApprovedBusinessPlatformRoles"()',
  'DROP TRIGGER IF EXISTS "Business_syncMemberPlatformRoles" ON "Business"',
  'DROP FUNCTION IF EXISTS "syncApprovedBusinessMemberPlatformRoles"()',
]) {
  assert.ok(
    finalRoleSyncCleanup.includes(expected),
    `Final B2B role-sync cleanup is missing: ${expected}`,
  );
}

console.log("canonical B2B authorization architecture: OK");
