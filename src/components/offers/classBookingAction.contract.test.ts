import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("class CTA always produces an actionable booking flow or visible error", () => {
  const page = read("./OfferPageView.tsx");
  assert.match(page, /if \(data\.classSlotBookingEnabled\) \{\s*setClassBookingOpen\(true\)/);
  assert.match(page, /if \(isClassOffer && direct\) \{\s*setClassRequestOpen\(true\)/);
  assert.match(page, /open=\{classRequestOpen\}/);
  assert.match(page, /onRequestInstead=\{isClassOffer && direct/);
  assert.match(page, /toast\.error\("Организатор пока не подключил приём заявок/);
});

test("fallback request reaches existing authenticated business Direct inbox", () => {
  const modal = read("../direct/DirectRequestModal.tsx");
  const route = read("../../app/api/public/direct/route.ts");
  assert.match(modal, /fetch\("\/api\/public\/direct"/);
  assert.match(modal, /bookingIntent \? "Запись на занятие"/);
  assert.match(modal, /Хочу записаться на занятие/);
  assert.match(route, /createDirectThread/);
  assert.match(route, /notifyDirectCreated/);
  assert.match(modal, /redirectTo: currentPath/);
});
