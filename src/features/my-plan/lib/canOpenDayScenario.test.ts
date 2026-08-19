import assert from "node:assert/strict";
import { canOpenDayScenario, resolveScenarioCtaState, resolveScenarioCtaLabel } from "./canOpenDayScenario";

assert.equal(canOpenDayScenario(0), false, "0 items — no CTA");
assert.equal(canOpenDayScenario(1), false, "1 item — no CTA");
assert.equal(canOpenDayScenario(2), false, "2 items — no CTA");
assert.equal(canOpenDayScenario(3), true, "3 items — CTA available");
assert.equal(canOpenDayScenario(4), true, "4+ items — CTA available");

// ── resolveScenarioCtaState / resolveScenarioCtaLabel ──
assert.equal(resolveScenarioCtaState(2, undefined), "hidden", "2 items, no scenario -> hidden");
assert.equal(resolveScenarioCtaLabel(resolveScenarioCtaState(2, undefined)), null);

assert.equal(resolveScenarioCtaState(3, undefined), "create", "3 items, no scenario -> create");
assert.equal(
  resolveScenarioCtaLabel(resolveScenarioCtaState(3, undefined)),
  "Собрать сценарий дня",
);

assert.equal(resolveScenarioCtaState(3, "ready"), "open", "scenario exists, unchanged -> open");
assert.equal(resolveScenarioCtaLabel(resolveScenarioCtaState(3, "ready")), "Открыть сценарий дня");

assert.equal(resolveScenarioCtaState(3, "changed"), "changed");
assert.equal(
  resolveScenarioCtaLabel(resolveScenarioCtaState(3, "changed")),
  "Сценарий дня · План изменился",
);

// An existing Scenario is never hidden even if the plan later drops below 3 —
// only *creating* a new one is threshold-gated.
assert.equal(
  resolveScenarioCtaState(1, "ready"),
  "open",
  "existing Scenario stays reachable even below the creation threshold",
);
assert.equal(
  resolveScenarioCtaState(1, "changed"),
  "changed",
  "same for the changed state",
);

console.log("canOpenDayScenario tests: OK");
