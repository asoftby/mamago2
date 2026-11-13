import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

// /me loads the family once via the shared loader and passes it down.
const mePage = read("src/app/(public)/me/page.tsx");
assert.match(mePage, /loadFamilyBlockData\(prisma, user\)/, "/me loads family data once");
assert.match(mePage, /familyBlock=\{familyBlockProps\}/, "/me passes the family block to AccountDesign");
assert.doesNotMatch(mePage, /manageFamilyHref/, "no more redirect to /me/profile");

// The loader is the single place that checks the flags; null when reads are off.
const loader = read("src/server/family/familyBlockData.ts");
assert.match(loader, /if \(!familyReadsEnabled\(\)\) return null/, "block hidden without FAMILY_CORE_READS");
assert.match(loader, /familyInvitesEnabled\(\)/);

// /me/profile uses the same loader (no duplicated flag logic).
const profile = read("src/app/(public)/me/profile/page.tsx");
assert.match(profile, /loadFamilyBlockData/);

// AccountDesign: inline edit/add via the existing modal and the invites block, no "Управлять".
const design = read("src/features/me/components/account/AccountDesign.tsx");
assert.doesNotMatch(design, /Управлять/);
assert.match(design, /editAdult=/);
assert.match(design, /childData=/);
assert.match(design, /\{familyBlock \? \(/, "invites block only when data is present");
assert.match(design, /variant="account"/);
assert.doesNotMatch(design, /fetch\(["'`]\/api\/family/, "no extra client family requests");
console.log("accountFamilyInline.contract.test: ok");
