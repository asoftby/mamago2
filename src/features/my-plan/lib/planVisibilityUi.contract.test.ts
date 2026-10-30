import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const dir = "src/app/(public)/me/plan/";

const page = read(dir + "page.tsx");
assert.match(page, /familyReadsEnabled\(\)/, "shared-plan UI is behind the flag");
assert.match(page, /adultIds\.length > 1/, "UI only for 2+ adults");
assert.match(page, /familyView=\{familyView\}/);

const client = read(dir + "PlanPageClient.tsx");
assert.match(client, /showFamilyUi\(familyView\)/);
// Family view reaches the day and week lists only for a shared family (otherwise null, so no chips render).
assert.match(client, /familyView=\{familyUi \? familyView : null\}/, "chips render only for a shared family");
assert.doesNotMatch(client, /familyView=\{familyView\}/, "the raw family view is never passed straight to the lists");
// The page keeps one audience filter state and no longer reads storage itself; if storage access
// comes back, it must stay wrapped in try/catch (it can throw in private windows and previews).
if (/localStorage/.test(client)) {
  assert.match(client, /try \{[\s\S]*localStorage/, "storage access is wrapped in try/catch");
}

const card = read(dir + "PlanItemCard.tsx");
assert.match(card, /Видите только вы/);
assert.match(card, /Поделиться с семьёй/);
assert.match(card, /Сделать личным/);
assert.match(card, /\/api\/plan\/items\/\$\{item\.id\}\/visibility/);
assert.match(card, /familyUi && isOwn/, "share/private action is author-only and family-only");
console.log("planVisibilityUi.contract.test: ok");
