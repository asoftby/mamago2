import assert from "node:assert/strict";
import test from "node:test";
import { createImpressionGate } from "./impressionGate";

function harness() {
  const timers = new Map<number, () => void>();
  let next = 1;
  let impressions = 0;
  const gate = createImpressionGate({
    onImpression: () => {
      impressions += 1;
    },
    setTimer: (fn) => {
      timers.set(next, fn);
      return next++;
    },
    clearTimer: (h) => {
      timers.delete(h as number);
    },
  });
  const flush = () => {
    for (const [id, fn] of [...timers]) {
      timers.delete(id);
      fn();
    }
  };
  return { gate, flush, timers, count: () => impressions };
}

test("impression fires after continuous >=50% visibility for the dwell time", () => {
  const h = harness();
  h.gate.update(0.5);
  assert.equal(h.count(), 0);
  h.flush();
  assert.equal(h.count(), 1);
  assert.equal(h.gate.fired, true);
});

test("below 50% never starts the timer", () => {
  const h = harness();
  h.gate.update(0.49);
  assert.equal(h.timers.size, 0);
});

test("leaving the viewport before the dwell time cancels the impression", () => {
  const h = harness();
  h.gate.update(0.8);
  h.gate.update(0.2);
  h.flush();
  assert.equal(h.count(), 0);
});

test("repeated visibility updates do not double-fire", () => {
  const h = harness();
  h.gate.update(0.6);
  h.gate.update(0.9);
  h.flush();
  h.gate.update(1);
  h.flush();
  assert.equal(h.count(), 1);
});
