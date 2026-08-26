import assert from "node:assert/strict";
import type { StoryCollection, StoryItem } from "../types/story";
import { resolvePublicStoryPresentation } from "./resolvePublicStoryPresentation";

function item(id: string, eyebrow: string, offerId = id): StoryItem {
  return {
    id,
    offerId,
    title: id,
    image: `/media/${id}.jpg`,
    eyebrow,
  };
}

const free: StoryCollection = {
  id: "free",
  intent: "free",
  title: "Бесплатно",
  items: [item("free-1", "бесплатно")],
};

{
  const result = resolvePublicStoryPresentation([
    {
      id: "running",
      intent: "running",
      title: "Идёт сейчас",
      items: [
        item("running-now", "Идёт сейчас · до 18:00"),
        item("running-today", "Сегодня · 19:00–20:00"),
      ],
    },
    free,
  ]);

  assert.deepEqual(result.map((collection) => collection.intent), ["today", "free"]);
  assert.equal(result[0]?.title, "Сегодня");
  assert.deepEqual(result[0]?.items.map((entry) => entry.id), ["running-now", "running-today"]);
  assert.ok(result[0]?.items.every((entry) => entry.eyebrow === "сегодня"));
  console.log("internal running source is folded into the public Today circle: OK");
}

{
  const shared = item("shared", "сегодня");
  const result = resolvePublicStoryPresentation([
    {
      id: "today",
      intent: "today",
      title: "Custom admin title",
      items: [shared, item("today-2", "сегодня")],
    },
    {
      id: "running",
      intent: "running",
      title: "Идёт сейчас",
      items: [shared, item("serial-today", "Сегодня · 16:00")],
    },
    free,
  ]);

  assert.deepEqual(result.map((collection) => collection.intent), ["today", "free"]);
  assert.equal(result[0]?.title, "Сегодня", "public temporal title is canonical");
  assert.deepEqual(
    result[0]?.items.map((entry) => entry.id),
    ["shared", "today-2", "serial-today"],
    "Today + serial Today are merged and exact duplicate items are removed",
  );
  assert.equal(result[0]?.items.find((entry) => entry.id === "serial-today")?.eyebrow, "сегодня");
  console.log("canonical Today merge/dedupe: OK");
}

{
  const result = resolvePublicStoryPresentation([
    {
      id: "today",
      intent: "today",
      title: "Сегодня",
      items: [
        item("session-morning", "сегодня", "activity-1"),
        item("session-evening", "сегодня", "activity-1"),
      ],
    },
    free,
  ]);

  assert.deepEqual(
    result[0]?.items.map((entry) => entry.id),
    ["session-morning", "session-evening"],
    "distinct occurrences sharing seen-state identity must remain in the viewer",
  );
  console.log("distinct Today occurrences are preserved: OK");
}

{
  const result = resolvePublicStoryPresentation([
    {
      id: "today",
      intent: "today",
      title: "Сегодня",
      items: [
        item("point-1", "сегодня"),
        item("point-2", "сегодня"),
        item("point-3", "сегодня"),
        item("point-4", "сегодня"),
      ],
    },
    {
      id: "running",
      intent: "running",
      title: "Идёт сейчас",
      items: [
        item("serial-1", "Сегодня · 16:00"),
        item("serial-2", "Сегодня · 18:00"),
      ],
    },
    free,
  ]);

  assert.deepEqual(
    result[0]?.items.map((entry) => entry.id),
    ["point-1", "point-2", "point-3", "point-4", "serial-1"],
    "Today keeps the five-item limit and serial programs fill remaining capacity",
  );
  console.log("Today item limit/fill strategy: OK");
}

{
  const breaking: StoryCollection = {
    id: "breaking_news",
    intent: "breaking_news",
    title: "Срочно",
    items: [item("breaking-1", "важно")],
  };
  const result = resolvePublicStoryPresentation([breaking, free]);
  assert.deepEqual(result.map((collection) => collection.intent), ["breaking_news", "free"]);
  console.log("non-temporal contextual/editorial circles keep their order: OK");
}

console.log("resolvePublicStoryPresentation tests: all OK");
