import assert from "node:assert/strict";
import { getDefaultFormData } from "./defaults";
import { evaluateEventStepNavigation, formatEventStepNavigationIssues } from "./navigation";

const draft = getDefaultFormData();
const attempt = (role: "ADMIN" | "MODERATOR" | "USER" | null, step: number, isLoadingGenres = false) =>
  evaluateEventStepNavigation({
    role,
    step,
    data: draft,
    context: {},
    isLoadingGenres,
  });

// Staff must never need a second click or a complete step to navigate.
for (const role of ["ADMIN", "MODERATOR"] as const) {
  assert.deepEqual(attempt(role, 1, true), { canContinue: true, issues: [] });
}
// Non-staff retain sequential completion requirements, but get the reason.
const blocked = attempt("USER", 1);
assert.equal(blocked.canContinue, false);
assert.ok(blocked.issues.some((issue) => issue.includes("Название")));
assert.ok(blocked.issues.some((issue) => issue.includes("формат")));
assert.deepEqual(attempt("USER", 1, true), {
  canContinue: false,
  issues: ["Дождитесь загрузки жанров"],
});
// Optional contact step is passable even with an empty draft.
assert.deepEqual(attempt("USER", 7), { canContinue: true, issues: [] });
assert.equal(formatEventStepNavigationIssues([]), undefined);
assert.equal(formatEventStepNavigationIssues(["Поле A", "Поле B"]), "Поле A · Поле B");
console.log("Event wizard navigation: OK");
