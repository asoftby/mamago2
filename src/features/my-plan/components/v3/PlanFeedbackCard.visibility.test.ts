import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasPendingPlanFeedback, type PlanExperienceFeed } from "./planExperienceApi";

const empty: PlanExperienceFeed = {
  pending: [],
  awaitingFeedback: [],
  visits: [],
  phoneVerified: true,
};
const historicVisit = {
  id: "visit-1",
  planItemId: "item-1",
  title: "Мероприятие",
  plannedDate: "2026-10-31",
  attendance: "ATTENDED" as const,
  feedbackSentiment: null,
  feedbackComment: null,
};

assert.equal(hasPendingPlanFeedback(null), false);
assert.equal(hasPendingPlanFeedback(empty), false);
assert.equal(hasPendingPlanFeedback({ ...empty, visits: [historicVisit] }), false,
  "completed visits alone must not mount the top carousel");
assert.equal(hasPendingPlanFeedback({ ...empty, pending: [{
  planItemId: "item-2",
  activityId: "activity-2",
  title: "Событие",
  plannedDate: "2026-11-01",
  plannedStartsAt: null,
}] }), true);
assert.equal(hasPendingPlanFeedback({ ...empty, awaitingFeedback: [historicVisit] }), true);

const feedbackSource = readFileSync(new URL("./PlanFeedbackCard.tsx", import.meta.url), "utf8");
const planSource = readFileSync(new URL("../PlanMainContent.tsx", import.meta.url), "utf8");
assert.match(feedbackSource, /if \(cards\.length === 0\) return null;/,
  "hide the entire carousel, including Все визиты, when no actionable cards remain");
assert.match(planSource, /if \(hasPendingPlanFeedback\(next\)\) return next;/);
assert.match(planSource, /return current === null \? current : null;/,
  "do not schedule a state update when history-only feed is already hidden");
assert.match(planSource, /История визитов/,
  "history remains available through the existing lower navigation link");

console.log("PlanFeedbackCard.visibility.test.ts: OK");
