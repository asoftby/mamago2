import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const page = read("src/app/(public)/me/profile/page.tsx");
assert.match(page, /familyReadsEnabled\(\)/, "block is behind FAMILY_CORE_READS");
assert.match(page, /FamilyMembersCard/);
const card = read("src/features/family/components/FamilyMembersCard.tsx");
assert.match(card, /\/api\/family\/invites/);
assert.match(card, /\/api\/family\/leave/);
assert.match(card, /\/api\/family\/transfer-owner/);
assert.doesNotMatch(card, /localStorage|sessionStorage/, "invite link and email are never persisted in the browser");
assert.doesNotMatch(card, /prisma|@prisma\/client/, "client component has no server imports");
// The raw link is shown once: only its text from the create response is kept in state.
assert.match(card, /показывается один раз/);
console.log("familyMembersUi.contract.test: ok");
