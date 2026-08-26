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
        item("running-future", "29 августа · 12:00–13:00"),
      ],
    },
    free,
  ]);

  assert.deepEqual(result.map((collection) => collection.intent), ["today", "free"]);
  assert.equal(result[0]?.title, "Сегодня");
  assert.deepEqual(result[0]?.items.map((entry) => entry.id), ["running-now", "running-today"]);
  assert.ok(result[0]?.items.every((entry) => entry.eyebrow === "сегодня"));
  console.log("running is folded into Today and future serial items are hidden: OK");
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
      id: "running",
      intent: "running",
      title: "Идёт сейчас",
      items: [item("future-only", "2 сентября · 10:00")],
    },
    free,
  ]);

  assert.deepEqual(result.map((collection) => collection.intent), ["free"]);
  console.log("future-only running collection does not masquerade as Today: OK");
}

console.log("resolvePublicStoryPresentation tests: all OK");
