import assert from "node:assert/strict";
import test from "node:test";
import { FIXED_PARTICIPATION_CTA_PREVIEW, normalizeParticipationMode } from "./participationCtaLabels";

test("«Оставить заявку» — настоящий режим участия", () => {
  assert.equal(normalizeParticipationMode("request"), "request");
  assert.equal(FIXED_PARTICIPATION_CTA_PREVIEW.request, "Оставить заявку");
});

test("остальные режимы не изменились, удалённые сценарии идут в «Подробнее»", () => {
  for (const mode of ["external-link", "time-slots", "walk-in", "prebook"] as const) {
    assert.equal(normalizeParticipationMode(mode), mode);
  }
  assert.equal(normalizeParticipationMode("info-only"), "walk-in");
  assert.equal(normalizeParticipationMode("simple-booking"), "walk-in");
  assert.equal(normalizeParticipationMode(undefined), "walk-in");
});
