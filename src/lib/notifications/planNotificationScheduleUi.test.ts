import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getPlanReminderOffsetOptions,
  resolveBrowserTimeZone,
} from "./planNotificationScheduleUi";

assert.equal(resolveBrowserTimeZone("Europe/Amsterdam"), "Europe/Amsterdam");
assert.equal(resolveBrowserTimeZone(""), null);
assert.equal(resolveBrowserTimeZone("Not/A_Timezone"), null);
assert.deepEqual(getPlanReminderOffsetOptions(false), [30, 60, 120, 180]);
assert.deepEqual(getPlanReminderOffsetOptions(true), [5, 30, 60, 120, 180]);

const scheduleSource = readFileSync(
  "src/app/(public)/me/settings/notifications/PlanNotificationScheduleSettings.tsx",
  "utf8",
);
assert.match(scheduleSource, /Вечером накануне/);
assert.match(scheduleSource, /Перед событием/);
assert.match(scheduleSource, /Не удалось загрузить настройки/);
assert.match(scheduleSource, /Повторить/);
assert.doesNotMatch(scheduleSource, />Часовой пояс</);
assert.doesNotMatch(scheduleSource, />Вручную</);
assert.match(scheduleSource, /accent="green"/);

const preferencesSource = readFileSync(
  "src/app/(public)/me/settings/notifications/NotificationPreferencesClient.tsx",
  "utf8",
);
assert.match(preferencesSource, /\/api\/settings\/telegram\/link/);
assert.match(preferencesSource, /method: "POST"/);
assert.match(preferencesSource, /void handleTelegramConnect\(\)/);
assert.doesNotMatch(preferencesSource, /!embedded && \(\s*<section/);

console.log("plan-notification-schedule-ui tests: OK");
