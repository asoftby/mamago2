import assert from "node:assert/strict";
import { resolveMobileBottomSlot } from "./bottomSlot";

const cases: Array<[string, ReturnType<typeof resolveMobileBottomSlot>]> = [
  ["/minsk", "plan"],
  ["/minsk/events", "plan"],
  ["/blog", "plan"],
  ["/minsk/events/some-event", "purchase"],
  ["/minsk/offers/some-offer", "purchase"],
  ["/me/plan", "none"],
  ["/minsk/my-plan/2026-10-10/scenario", "none"],
  ["/blog/some-article", "none"],
  ["/places/some-place", "none"],
  ["/admin/events", "none"],
];

for (const [path, slot] of cases) {
  assert.equal(resolveMobileBottomSlot(path), slot, path);
}
console.log("bottomSlot tests passed");
