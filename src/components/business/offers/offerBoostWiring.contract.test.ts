import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(file, "utf8");

test("Offer Boost must use the server-gated inline confirmation", () => {
  const card = read("src/components/business/offers/OfferCardHorizontal.tsx");
  assert.match(card, /<BoostLauncher/);
  assert.match(card, /publicationType: "OFFER", title: offer\.title/);
  assert.match(card, /disabled=\{offer\.boostDisabled !== false\}/);
  assert.match(card, /cooldownUntil=\{offer\.boostNextFreeAt\}/);
  assert.doesNotMatch(card, /buildBusinessBoostHref/);
});

test("Offer active timer uses persisted server Boost end, not a client-invented deadline", () => {
  const page = read("src/app/business/(protected)/offers/page.tsx");
  const card = read("src/components/business/offers/OfferCardHorizontal.tsx");
  const source = read("src/server/services/promotion/dailyFreeBoost.service.ts");
  assert.match(page, /boostDisabled: !freeBoost\.availableToday/);
  assert.match(page, /boostEndsAt: boostCandidates\.get\(offer\.id\)\?\.activeBoostUntil/);
  assert.match(page, /isPromoted: Boolean\(boostCandidates\.get\(offer\.id\)\?\.activeBoostUntil\)/);
  assert.match(source, /activeBoostUntil: offer\.boosts\[0\]\?\.endAt\.toISOString\(\)/);
  assert.match(card, /<PublicationBoostActiveButton endsAt=\{offer\.boostEndsAt\}/);
});
