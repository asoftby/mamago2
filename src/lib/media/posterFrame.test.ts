import assert from "node:assert/strict";
import {
  POSTER_RATIO_MAX,
  POSTER_RATIO_MIN,
  posterPriceBadgeSide,
  resolvePosterFrame,
} from "./posterFrame";

assert.equal(POSTER_RATIO_MIN, 9 / 16);
assert.equal(POSTER_RATIO_MAX, 3 / 2);

// Acceptance: A4, square, 4:5, 16:9 are shown whole.
for (const [w, h] of [[2480, 3508], [1000, 1000], [800, 1000], [1600, 900], [1131, 1600]] as const) {
  const frame = resolvePosterFrame(w, h);
  assert.equal(frame.cropped, false, `${w}x${h} must not be cropped`);
  assert.equal(frame.aspectRatio, `${w} / ${h}`);
  assert.ok(Math.abs(frame.ratio - h / w) < 1e-9);
}

// Boundaries are inclusive.
assert.equal(resolvePosterFrame(1600, 900).cropped, false);
assert.equal(resolvePosterFrame(1000, 1500).cropped, false);

// 1:2 → 2:3 anchored top.
const tall = resolvePosterFrame(800, 1600);
assert.deepEqual([tall.aspectRatio, tall.objectPosition, tall.cropped], ["2 / 3", "top", true]);

// 3:1 → 16:9 anchored center.
const wide = resolvePosterFrame(1500, 500);
assert.deepEqual([wide.aspectRatio, wide.objectPosition, wide.cropped], ["16 / 9", "center", true]);

// Unknown → 4:5 anchored top.
for (const [w, h] of [[null, null], [undefined, 100], [0, 100], [100, Number.NaN], [-1, 10]] as const) {
  const frame = resolvePosterFrame(w as number | null, h as number | null);
  assert.deepEqual([frame.aspectRatio, frame.objectPosition, frame.dimensionsKnown], ["4 / 5", "top", false]);
}

// Overlay readability: the shortest allowed frame (16:9) on the narrowest
// 2-column mobile column (~150px) must not stack the 44px like button and
// the 28px price badge in the same corner (12px insets).
const columnWidth = 150;
const shortest = resolvePosterFrame(1920, 1080);
const frameHeight = columnWidth * shortest.ratio;
const stackedHeight = 12 + 44 + 28 + 12;
assert.ok(frameHeight < stackedHeight, "precondition: 16:9 is too low to stack overlays");
assert.equal(posterPriceBadgeSide(shortest), "left");
// Tall enough frames keep the existing bottom-right badge.
for (const frame of [resolvePosterFrame(1000, 1000), resolvePosterFrame(800, 1000), resolvePosterFrame(800, 1600), resolvePosterFrame(null, null)]) {
  assert.ok(columnWidth * frame.ratio >= stackedHeight);
  assert.equal(posterPriceBadgeSide(frame), "right");
}

console.log("Poster frame rule (ratios, anchors, unknown fallback, overlay placement): OK");
