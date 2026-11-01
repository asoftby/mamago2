import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ui = readFileSync(new URL("./ExperienceCheckIn.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../../../api/plan/experiences/[id]/attendance/route.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("../../../../server/services/experience/experience.service.ts", import.meta.url), "utf8");

assert.match(ui, /aria-roledescription="карусель"/);
assert.match(ui, /Предыдущее посещение/);
assert.match(ui, /Следующее посещение/);
assert.match(ui, /\{index \+ 1\} из \{visible\.length\}/);
assert.match(ui, /visible\.map\(\(card, cardIndex\) =>/);
assert.match(ui, /hidden=\{cardIndex !== index\}/);
assert.match(ui, /onFinishedRef\.current\(\)/);
assert.match(ui, /onFinishedRef\.current = onFinished/);
assert.match(ui, /key=\{card\.id\}/);
assert.match(ui, /aria-label="Закрыть карточку посещения"/);
assert.match(ui, /mamago:experience-snooze:/);
assert.match(ui, /Мы не были/);
assert.match(ui, /markNotAttended\(\)/);
assert.match(ui, /method: "PATCH"/);
assert.match(ui, /attendance: "NOT_ATTENDED"/);
assert.match(ui, /canCorrectAttendance !== false/);
assert.match(ui, /PhoneVerificationModal/);
assert.match(ui, /EMOJI_RATING_OPTIONS/);
assert.match(ui, /Отправить отзыв/);

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
