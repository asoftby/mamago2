import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanEventScreen } from "./PlanEventScreen";
import type { PlanItemWithActivity } from "../../types/event";

const item = {
  id: "p1",
  userId: "u",
  activityId: "a1",
  date: "2026-11-14",
  startsAt: new Date("2026-11-14T12:00:00"),
  title: null,
  coverImageUrl: null,
  createdAt: new Date("2026-10-01"),
  source: "CATALOG",
  activity: {
    id: "a1",
    slug: "kot",
    title: "Спектакль «Кот в сапогах»",
    type: "EVENT",
    coverImageUrl: null,
    ageLabel: "3+",
    eventCategory: null,
    priceFrom: 15,
    priceText: null,
    currency: "BYN",
    status: "PUBLISHED",
    owner: null,
    place: { title: "ТЮЗ", shortAddress: "ул. Энгельса, 26", formattedAddr: null, customAddress: null, city: null },
    venue: null,
    scheduleJson: { participationMode: "external-link", ticketLink: "https://tickets.example.com/x" },
  },
} as unknown as PlanItemWithActivity;

const html = renderToStaticMarkup(
  <PlanEventScreen item={item} onBack={() => undefined} onRemove={() => undefined} onMove={() => undefined} />,
);
assert.match(html, /Кот в сапогах/);
assert.match(html, />3\+</);
assert.match(html, /ТЮЗ/);
assert.match(html, /Купить билет/);
assert.match(html, /aria-label="Удалить из плана"/);
assert.match(html, /aria-label="Перенести"/);

const noMove = renderToStaticMarkup(
  <PlanEventScreen item={item} onBack={() => undefined} onRemove={() => undefined} />,
);
assert.doesNotMatch(noMove, /aria-label="Перенести"/);
console.log("PlanEventScreen tests: OK");

// Цена идёт через канонический контракт priceMode, а не «от» по умолчанию.
const exact = renderToStaticMarkup(
  <PlanEventScreen
    item={{ ...item, activity: { ...item.activity!, priceMode: "EXACT", priceFrom: 15 } } as PlanItemWithActivity}
    onBack={() => undefined}
    onRemove={() => undefined}
  />,
);
assert.doesNotMatch(exact, /от\s*15/);
