import { describe, expect, it } from "vitest";
import { eventTemporalScore } from "./eventTemporalRanking";

const now = new Date("2026-10-21T09:00:00.000Z");
const at = (day: number) => ({ startsAt: new Date(now.getTime() + day * 86_400_000) });
const score = (days: number[]) => eventTemporalScore({ now, nextOccurrenceAt: null, sessions: days.map(at) });

describe("eventTemporalScore", () => {
  it("prioritizes a one-off tomorrow over a daily long-running event", () => {
    expect(score([1])).toBeGreaterThan(score(Array.from({ length: 14 }, (_, i) => i + 1)));
  });
  it("raises events about to end", () => {
    expect(score([1, 2])).toBeGreaterThan(score([1, 5, 10]));
  });
  it("does not score past sessions as upcoming", () => {
    expect(score([-4, -1])).toBe(5);
  });
  it("supports denormalized next occurrences without materialized sessions", () => {
    expect(eventTemporalScore({ now, nextOccurrenceAt: at(2).startsAt, sessions: [] })).toBeGreaterThan(5);
  });
  it("remains bounded", () => {
    expect(score([0])).toBeLessThanOrEqual(100);
  });
});
