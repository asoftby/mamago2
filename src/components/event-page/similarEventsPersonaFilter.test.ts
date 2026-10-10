import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
import { matchesSelectedPersonaAudience } from "@/lib/discovery/audienceEligibility";

const yearsAgo = (years: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
};
const adult: FamilyPersona = { id: "adult", kind: "adult", displayName: "Я" };
const child: FamilyPersona = { id: "child", kind: "child", displayName: "Степан", birthDate: yearsAgo(2) };
const personas = [adult, child];

const toddler = { agePolicy: "SPECIFIC" as const, ageFrom: 1, ageTo: 3 };
const teen = { agePolicy: "SPECIFIC" as const, ageFrom: 12, ageTo: 16 };
const adultOnly = { agePolicy: "ADULT_ONLY" as const, ageFrom: 18, ageTo: 99 };
const everyone = { agePolicy: "UNRESTRICTED" as const, ageFrom: 0, ageTo: 99 };

// Свободный поиск (никого не выбрали) — фильтр не применяется.
for (const item of [toddler, teen, adultOnly, everyone]) {
  assert.equal(matchesSelectedPersonaAudience(item, { personas, selectedPersonaIds: [] }), true);
}

// Выбран ребёнок 2 лет: подходят детские и «для всех», не подходят подростковые и 18+.
const forChild = { personas, selectedPersonaIds: ["child"] };
assert.equal(matchesSelectedPersonaAudience(toddler, forChild), true);
assert.equal(matchesSelectedPersonaAudience(everyone, forChild), true);
assert.equal(matchesSelectedPersonaAudience(teen, forChild), false);
assert.equal(matchesSelectedPersonaAudience(adultOnly, forChild), false);

// «Я + ребёнок» — выигрывает ребёнок.
assert.equal(matchesSelectedPersonaAudience(adultOnly, { personas, selectedPersonaIds: ["adult", "child"] }), false);

// Wiring: EventPageView фильтрует похожие на клиенте (пока персоны грузятся — показывает всех) и режет до 4;
// сервер отдаёт запас больше 4, иначе после фильтра блок почти всегда пустой.
const view = readFileSync(new URL("./EventPageView.tsx", import.meta.url), "utf8");
assert.match(view, /useFamilyPersona\(\)/);
assert.match(view, /familyPersona\.loading\) return true/);
assert.match(view, /matchesSelectedPersonaAudience\(item,/);
assert.match(view, /candidates\.slice\(0, 4\)/);
const page = readFileSync(
  new URL("../../app/(public)/[city]/events/[slugOrId]/page.tsx", import.meta.url),
  "utf8",
);
assert.match(page, /limit: 12,/);

// Экспозиции: клиент один раз сообщает серверу реально показанные ID (после фильтра и обрезки до 4).
assert.match(view, /\/api\/recommendations\/exposures\/shown/);
assert.match(view, /reportedSimilarRunRef\.current === similarRunId/);
assert.match(view, /personasReady/);
const route = readFileSync(
  new URL("../../app/api/recommendations/exposures/shown/route.ts", import.meta.url),
  "utf8",
);
assert.match(route, /narrowRunExposuresToShown\(/);
assert.match(route, /SIMILAR_EVENTS_INTENT/);

console.log("similar events persona filter: OK");
