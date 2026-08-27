import assert from "node:assert/strict";
import { fromZonedTime } from "date-fns-tz";
import { STORY_SLOTS } from "./registry";
import { todayRange } from "./ranges";
import type { ResolveContext } from "./types";

const ctx: ResolveContext = {
  now: fromZonedTime("2026-08-27T18:30:00", "Europe/Minsk"),
  timeZone: "Europe/Minsk",
  cityId: "city-test",
  hasBreakingNews: false,
};

const running = STORY_SLOTS.find((slot) => slot.id === "running");
assert.ok(running, "running technical source must exist");

const expected = todayRange(ctx);
const actual = running.range(ctx);
assert.ok(actual, "running technical source must resolve a range");
assert.equal(actual.start.getTime(), expected.start.getTime());
assert.equal(actual.end.getTime(), expected.end.getTime());

console.log("running technical source is bounded to the current city day: OK");
