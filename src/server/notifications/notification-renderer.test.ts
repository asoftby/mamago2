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

{
  const rendered = renderNotificationContentCore("PLAN_EVENT_2H_BEFORE", {
    planItemId: "plan_dst",
    eventTitle: "DST test",
    startsAt: new Date("2026-03-29T22:30:00.000Z"),
    timeZone: "Europe/Amsterdam",
  });
  assert.equal(rendered.body, "В 00:30 у вас в плане: DST test");
  assert.equal(rendered.ctaUrl, "/me/day/2026-03-30");
}

{
  const rendered = renderNotificationContentCore("PLAN_TOMORROW_DIGEST", {
    digestDate: "2026-05-15",
    citySlug: "minsk",
    planItemIds: ["plan_1", "plan_2"],
    items: [
      {
        planItemId: "plan_1",
        activityId: "activity_1",
        eventTitle: "Детский спектакль",
        startsAt: new Date("2026-05-15T08:00:00.000Z"),
        placeName: "Театр кукол",
        cityName: "Минск",
      },
      {
        planItemId: "plan_2",
        activityId: "activity_2",
        eventTitle: "Мастер-класс",
        startsAt: null,
        placeName: null,
        cityName: "Минск",
      },
    ],
  });

  assert.equal(rendered.title, "Завтра в плане");
  assert.equal(
    rendered.body,
    "11:00 — Детский спектакль\n📍 Театр кукол\n\nМастер-класс",
  );
  assert.equal(rendered.ctaLabel, "Открыть мой план");
  assert.equal(rendered.ctaUrl, "/me/plan");
}

console.log("notification-renderer tests: OK");
