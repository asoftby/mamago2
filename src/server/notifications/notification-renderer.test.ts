import assert from "node:assert/strict";

import { renderNotificationContentCore } from "./notification-renderer-core";

{
  const rendered = renderNotificationContentCore("PLAN_EVENT_2H_BEFORE", {
    planItemId: "plan_1",
    activityId: "activity_1",
    eventTitle: "Мастер-класс по рисованию",
    startsAt: new Date("2026-04-24T15:00:00+03:00"),
    placeName: "Арт-студия",
    cityName: "Минск",
  });

  assert.equal(rendered.title, "Скоро событие");
  assert.equal(
    rendered.body,
    "В 15:00 у вас в плане: Мастер-класс по рисованию",
  );
  assert.equal(rendered.ctaLabel, "Открыть план");
  assert.equal(rendered.ctaUrl, "/me/day/2026-04-24");
}

console.log("notification-renderer tests: OK");
