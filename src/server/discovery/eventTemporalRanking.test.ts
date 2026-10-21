import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eventTemporalScore, KUDA_DEFAULT_HORIZON_DAYS, KUDA_SEASONAL_HORIZON_DAYS } from "./eventTemporalRanking";

const now = new Date("2026-10-21T09:00:00.000Z");
const at = (day: number) => ({ startsAt: new Date(now.getTime() + day * 86_400_000) });
const score = (days: number[]) => eventTemporalScore({ now, nextOccurrenceAt: null, sessions: days.map(at) });

describe("eventTemporalScore", () => {
  it("prioritizes a one-off tomorrow over a daily long-running event", () => {
    assert.ok(score([1]) > score(Array.from({ length: 14 }, (_, i) => i + 1)));
  });
  it("raises events about to end", () => {
    assert.ok(score([1, 2]) > score([1, 5, 10]));
  });
  it("does not score past sessions as upcoming", () => {
    assert.equal(score([-4, -1]), 5);
  });
  it("supports denormalized next occurrences without materialized sessions", () => {
    assert.ok(eventTemporalScore({ now, nextOccurrenceAt: at(2).startsAt, sessions: [] }) > 5);
  });
  it("uses the 45-day default and 90-day seasonal planning horizons", () => {
    assert.equal(KUDA_DEFAULT_HORIZON_DAYS, 45);
    assert.equal(KUDA_SEASONAL_HORIZON_DAYS, 90);
    assert.ok(score([30]) > score([44]));
    assert.ok(score([44]) > score([70]));
  });
  it("keeps seasonal events discoverable without outranking nearby events", () => {
    const christmas = eventTemporalScore({ now, nextOccurrenceAt: null, sessions: [at(65)], seasonal: true });
    assert.ok(christmas > score([65]));
    assert.ok(score([1]) > christmas);
  });
  it("remains bounded", () => {
    assert.ok(score([0]) <= 100);
  });
});
