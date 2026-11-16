import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ui = readFileSync(new URL("./ExperienceCheckIn.tsx", import.meta.url), "utf8");
const planFeedback = readFileSync(
  new URL("../../../../features/my-plan/components/v3/PlanFeedbackCard.tsx", import.meta.url),
  "utf8",
);
const api = readFileSync(new URL("../../../api/plan/experiences/[id]/attendance/route.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("../../../../server/services/experience/experience.service.ts", import.meta.url), "utf8");

// Desktop /me/plan reuses the overlay check-in card instead of a parallel light design.
assert.match(ui, /PlanFeedbackCard/);
assert.match(ui, /MY_PLAN_V3_TOKENS/);
assert.match(ui, /onOpenVisits/);
assert.match(ui, /awaitingFeedback/);
assert.match(ui, /router\.refresh\(\)/);

assert.match(planFeedback, /mamago:plan-feedback-snooze:/);
assert.match(planFeedback, /aria-label="Закрыть вопрос о посещении"/);
assert.match(planFeedback, /Мы не ходили/);
assert.match(planFeedback, /PhoneVerificationModal/);
assert.match(planFeedback, /PLAN_FACES/);

assert.match(api, /export async function PATCH/);
assert.match(api, /getCurrentUser/);
assert.match(api, /z\.literal\("NOT_ATTENDED"\)/);
assert.match(api, /correctUnratedExperienceAttendance/);
assert.match(service, /userId: input\.userId/);
assert.match(service, /planScopeFor\(input\.userId\)/);
assert.match(service, /attendance: "ATTENDED",\s*feedbackSentiment: null,\s*feedbackAt: null/);
assert.match(service, /attendance: "NOT_ATTENDED"/);
assert.match(service, /A rated visit cannot be corrected/);
assert.match(service, /attendance: "ATTENDED", feedbackSentiment: null/);
assert.match(service, /Attendance was corrected before feedback/);
assert.match(service, /canCorrectAttendance: row\.userId === input\.userId/);

const affinity = readFileSync(new URL("../../../../server/services/recommendations/experienceAffinity.ts", import.meta.url), "utf8");
assert.match(service, /eventType: "ATTENDANCE_CORRECTED"/);
assert.match(service, /attendance_corrected/);
assert.match(affinity, /eventType === "ATTENDANCE_CORRECTED"/);
assert.match(affinity, /where: \{ id: \{ in: attendedIds \}, userId: input\.userId \}/);
assert.match(affinity, /visit\.attendance === "ATTENDED"/);
assert.match(affinity, /stillAttendedIds\.has\(id\)/);

console.log("ExperienceCheckIn.carousel.test.ts: OK");
