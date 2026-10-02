import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = readFileSync(new URL("./experience.service.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../../../../prisma/schema.prisma", import.meta.url), "utf8");
const analyticsService = readFileSync(
  new URL("../analytics/AnalyticsEventService.ts", import.meta.url),
  "utf8",
);
const genericAnalyticsRoute = readFileSync(
  new URL("../../../app/api/analytics/events/route.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL("../../../../prisma/migrations/20261001134500_add_plan_experience_feedback_loop/migration.sql", import.meta.url),
  "utf8",
);
const reminder = readFileSync(
  new URL("../../notifications/jobs/run-plan-event-reminders-core.ts", import.meta.url),
  "utf8",
);
const digest = readFileSync(
  new URL("../../notifications/jobs/run-plan-tomorrow-digests-core.ts", import.meta.url),
  "utf8",
);
const ui = readFileSync(
  new URL("../../../app/(public)/me/plan/ExperienceCheckIn.tsx", import.meta.url),
  "utf8",
);
const attendanceRoute = readFileSync(
  new URL("../../../app/api/plan/experiences/route.ts", import.meta.url),
  "utf8",
);
const feedbackRoute = readFileSync(
  new URL("../../../app/api/plan/experiences/[id]/feedback/route.ts", import.meta.url),
  "utf8",
);
const engagementWeights = readFileSync(
  new URL("../../discovery/engagementWeights.ts", import.meta.url),
  "utf8",
);
const experienceModel = schema.match(/model Experience \{[\s\S]*?\n\}/)?.[0] ?? "";

assert.match(schema, /model Experience[\s\S]*sourcePlanItemId\s+String\s+@unique/);
assert.doesNotMatch(experienceModel, /sourcePlanItem\s+PlanItem/);
assert.doesNotMatch(experienceModel, /activity\s+Activity/);
assert.doesNotMatch(migration, /^\s*UPDATE\s+/im);
assert.doesNotMatch(migration, /^\s*INSERT\s+INTO\s+"Experience"/im);
assert.match(schema, /idempotencyKey\s+String\?\s+@unique/);
assert.match(migration, /UserEvent_idempotencyKey_key/);
assert.match(analyticsService, /PrismaClientKnownRequestError/);
assert.match(analyticsService, /error\.code === "P2002"/);
assert.doesNotMatch(genericAnalyticsRoute, /idempotencyKey/);
assert.match(service, /date:\s*\{\s*gte:\s*oldestDate,\s*lt:\s*today\s*\}/);
assert.match(service, /while \(candidates\.length < take\)/);
assert.doesNotMatch(service, /take:\s*Math\.max\(take \* 4, 12\)/);
assert.match(service, /eventType:\s*"ATTENDED"/);
assert.doesNotMatch(reminder, /experience|ATTENDED|EXPERIENCE_FEEDBACK/i);
assert.doesNotMatch(digest, /experience|ATTENDED|EXPERIENCE_FEEDBACK/i);
assert.match(ui, /Как прошло\?/);
assert.match(ui, /Да, были/);
assert.match(ui, /Не получилось/);
assert.match(ui, /Как вам\?/);
assert.match(ui, /Пропустить/);
assert.match(ui, /min-h-11/);
assert.doesNotMatch(ui, /dialog|modal/i);
assert.match(attendanceRoute, /getCurrentUser/);
assert.match(attendanceRoute, /planItemId/);
assert.doesNotMatch(attendanceRoute, /entityId.*z\./);
assert.match(feedbackRoute, /z\.enum\(\["LIKE", "NEUTRAL", "DISLIKE"\]\)/);
assert.doesNotMatch(engagementWeights, /ATTENDED|EXPERIENCE_FEEDBACK/);

console.log("experience.contract.test.ts: OK");
