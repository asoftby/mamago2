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

const legacyUsers = sourceFiles
  .filter((path) => relative(process.cwd(), path) !== legacyDefinition)
  .filter((path) => readFileSync(path, "utf8").includes("canCreateBusinessContent"))
  .map((path) => relative(process.cwd(), path));

assert.deepEqual(
  legacyUsers,
  [],
  `Legacy role-only B2B authorization remains in production code:\n${legacyUsers.join("\n")}`,
);

const businessOwnerRoleUsers = sourceFiles
  .filter((path) => relative(process.cwd(), path) !== legacyDefinition)
  .filter((path) => {
    const source = readFileSync(path, "utf8");
    return (
      source.includes('role === "BUSINESS_OWNER"') ||
      source.includes('role !== "BUSINESS_OWNER"') ||
      source.includes('role: "BUSINESS_OWNER"')
    );
  })
  .map((path) => relative(process.cwd(), path));

assert.deepEqual(
  businessOwnerRoleUsers,
  [],
  `Direct BUSINESS_OWNER authorization/state coupling remains in production code:\n${businessOwnerRoleUsers.join("\n")}`,
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

const verification = readFileSync(
  resolve(process.cwd(), "src/server/services/businessVerification.service.ts"),
  "utf8",
);
assert.equal(
  verification.includes('data: { role: "BUSINESS_OWNER" }'),
  false,
  "Business approval must not mutate User.role",
);
assert.match(verification, /businessMember\.upsert/);

const canonicalMigration = readFileSync(
  resolve(
    process.cwd(),
    "prisma/migrations/20260901193000_canonicalize_business_member_access/migration.sql",
  ),
  "utf8",
);
assert.match(canonicalMigration, /INSERT INTO "BusinessMember"/);
assert.match(canonicalMigration, /DROP TRIGGER IF EXISTS "BusinessMember_syncPlatformRole"/);
assert.match(canonicalMigration, /DROP TRIGGER IF EXISTS "Business_syncMemberPlatformRoles"/);

console.log("canonical B2B authorization architecture: OK");
