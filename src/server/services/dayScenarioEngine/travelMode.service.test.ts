import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getFamilyTravelMode, isStoredTravelMode, resolveTravelMode } from "./travelMode.service";

// ---- what the draft uses: the request's mode, else the family's saved one, else the car
assert.equal(resolveTravelMode("walk", "car"), "walk", "an explicit pick wins");
assert.equal(resolveTravelMode("car", "walk"), "car");
assert.equal(resolveTravelMode(undefined, "walk"), "walk", "no pick: the family's choice");
assert.equal(resolveTravelMode(undefined, "car"), "car");
assert.equal(resolveTravelMode(undefined, null), "car", "never chosen: the car");
assert.equal(resolveTravelMode(undefined, "bike"), "car", "an unknown stored value is ignored");
assert.equal(resolveTravelMode("transit", "walk"), "transit", "the model still accepts transit when asked");
assert.equal(isStoredTravelMode("walk") && isStoredTravelMode("car"), true);
assert.equal(isStoredTravelMode("transit") || isStoredTravelMode(null) || isStoredTravelMode(""), false, "only walk and car are stored");

async function run() {
  const db = (travelMode: string | null | undefined, member = true) => ({ familyMembership: { findFirst: async () => (member ? { family: { travelMode: travelMode ?? null } } : null) } }) as unknown as Parameters<typeof getFamilyTravelMode>[1];
  assert.equal(await getFamilyTravelMode("u1", db("walk")), "walk");
  assert.equal(await getFamilyTravelMode("u1", db(null)), null, "never chosen");
  assert.equal(await getFamilyTravelMode("u1", db("walk", false)), null, "no family");

  // ---- contracts
  const draft = readFileSync("src/server/services/dayScenarioEngine/draft.service.ts", "utf8");
  assert.match(draft, /mode: z\.enum\(\["walk", "car", "transit"\]\)\.optional\(\),/, "the draft no longer forces the car");
  assert.match(draft, /user && request\.mode === undefined \? await getFamilyTravelMode\(user\.id\) : null/, "the family is read only when the request left the mode out");
  const route = readFileSync("src/app/api/plan/day-scenario/travel-mode/route.ts", "utf8");
  assert.match(route, /if \(!isDayScenarioEngineEnabled\(\)\) return NextResponse\.json\(\{ error: "Not found" \}, \{ status: 404 \}\);\s*try \{\s*const user = await getCurrentUser\(\);/, "404 before any work");
  assert.match(route, /UNAUTHENTICATED[\s\S]*401/);
  assert.match(route, /isStoredTravelMode\(mode\)/);
  const migration = readFileSync("prisma/migrations/20261109120000_family_travel_mode/migration.sql", "utf8");
  assert.ok(/ALTER TABLE "Family" ADD COLUMN "travelMode" TEXT;/.test(migration) && !/\bDROP\b|DELETE FROM|^UPDATE /m.test(migration), "additive: one nullable column");
  const hook = readFileSync("src/features/my-plan/hooks/useDayScenarioDraft.ts", "utf8");
  assert.match(hook, /mode: q\.mode \?\? stateRef\.current\[date\]\?\.history\.current\?\.mode/, "later actions use the mode the first answer reported");
  const screen = readFileSync("src/features/my-plan/components/dayScenario/DayScenarioScreen.tsx", "utf8");
  assert.match(screen, /mode: pickedMode \?\? undefined/, "the first build leaves the mode to the server");
  assert.match(screen, /const mode: ScenarioMode = pickedMode \?\? current\?\.mode \?\? "car";/, "the toggle shows the mode the server used");
  assert.match(screen, /if \(isGuest\) return;[\s\S]*\/api\/plan\/day-scenario\/travel-mode/, "a member's pick is remembered, a guest's is not");
  assert.match(screen, /modeWrites\.current = modeWrites\.current\.then\(/, "preference writes are queued, so the last pick stays saved");
  assert.match(screen, /if \(next === mode\) \{[\s\S]*?if \(pickedMode === null\) persistMode\(next\);\s*return;\s*\}\s*setPickedMode\(next\);/, "choosing the mode already in use never rebuilds the draft");

  console.log("day-scenario travel mode tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
