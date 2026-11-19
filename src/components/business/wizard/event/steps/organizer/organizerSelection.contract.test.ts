/**
 * Organizer search and selection wiring regression.
 *
 * Runs without a live DB because the Next.js request auth context is not
 * available in this test process. CI typechecks the route; live request/DB
 * behavior must still be smoke-tested before production deployment.
 *
 * pnpm exec tsx src/components/business/wizard/event/steps/organizer/organizerSelection.contract.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const getRoute = readFileSync("src/app/api/admin/organizers/route.ts", "utf8");
const selectRoute = readFileSync(
  "src/app/api/business/events/organizer-from-verified-business/route.ts",
  "utf8",
);
const picker = readFileSync(
  "src/components/business/wizard/event/steps/organizer/OrganizerSearchSelect.tsx",
  "utf8",
);
const organizerStep = readFileSync(
  "src/components/business/wizard/event/steps/Step8Organizer.tsx",
  "utf8",
);

test("organizer search authorizes canonical business membership, not platform BUSINESS_OWNER role", () => {
  assert.match(getRoute, /checkBusinessToolPermission\(user, "content\.create"\)/);
  assert.doesNotMatch(getRoute, /\["ADMIN", "MODERATOR", "BUSINESS_OWNER"\]/);
  assert.match(selectRoute, /checkBusinessToolPermission\(user, "content\.create"\)/);
});

test("search includes approved active businesses but does not create organizer records", () => {
  assert.match(getRoute, /prisma\.business\.findMany/);
  assert.match(getRoute, /verificationStatus: "APPROVED"/);
  assert.match(getRoute, /operationalStatus: "ACTIVE"/);
  assert.match(getRoute, /legalName: \{ contains: query/);
  assert.match(getRoute, /unp: \{ contains: query/);
  assert.doesNotMatch(getRoute, /prisma\.organizer\.create/);
});

test("existing linked organizer takes priority and results deduplicate real ids", () => {
  assert.match(getRoute, /organizer\.linkedBusinessId === business\.id/);
  assert.match(getRoute, /const seen = new Set<string>\(\)/);
  assert.match(getRoute, /id: `business:\$\{business\.id\}`/);
});

test("select endpoint requires eligibility under a database lock and binds the organizer to Business", () => {
  assert.match(selectRoute, /prisma\.\$transaction/);
  assert.match(selectRoute, /FOR UPDATE/);
  assert.match(selectRoute, /verificationStatus: "APPROVED"/);
  assert.match(selectRoute, /operationalStatus: "ACTIVE"/);
  assert.match(selectRoute, /linkedBusinessId: business\.id/);
  assert.match(selectRoute, /findFirst\(\{\s*where: \{ linkedBusinessId: business\.id \}/);
  assert.match(selectRoute, /findUnique\(\{ where: \{ unp: business\.unp \} \}\)/);
});

test("selection creates only if absent and retries unique UNP conflict", () => {
  assert.match(selectRoute, /else if \(!organizer\) \{[\s\S]*?tx\.organizer\.create/);
  assert.match(selectRoute, /error\.code !== "P2002"/);
  assert.match(selectRoute, /result = await resolve\(\)/);
});

test("selection returns a real organizer id, never a Business placeholder", () => {
  assert.match(selectRoute, /id: organizer\.id/);
  assert.doesNotMatch(selectRoute, /id: `business:\$\{business\.id\}`/);
  assert.match(picker, /if \(!organizer\.id\.startsWith\("business:"\)\)/);
  assert.match(picker, /onSelect\(json\.organizer\)/);
});

test("request failures are displayed separately from an empty search result", () => {
  assert.match(picker, /setSearchError\(/);
  assert.match(picker, /role="alert"/);
  assert.match(picker, /searchError \? \(/);
  assert.match(picker, /Организатор не найден/);
});


test("event publisher and organizer roles are distinguished in the wizard", () => {
  assert.match(organizerStep, /Бизнес, которому принадлежит публикация, и организатор события — разные роли/);
  assert.match(organizerStep, /Выбрать компанию или существующего организатора/);
  assert.match(organizerStep, /Моя компания — организатор/);
});
