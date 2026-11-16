import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getBoostRemainingMinutes, formatBoostCountdown } from "@/lib/promotion/boostCountdown";

const read = (path: string) => readFileSync(path, "utf8");

test("Boost does not add a promotional badge to the business Event card", () => {
  const eventCard = read("src/components/business/events/EventCardHorizontal.tsx");
  assert.doesNotMatch(eventCard, />\s*Продвигается\s*</);
  assert.match(eventCard, /<BoostLauncher/);
  assert.match(eventCard, /publicationType: "EVENT", title: activity\.title/);
  assert.doesNotMatch(eventCard, /buildBusinessBoostHref/);
  const launcher = read("src/components/business/promotion/BoostLauncher.tsx");
  assert.match(launcher, /<Dialog open={open}/);
  assert.match(launcher, /Подтвердить бесплатно/);
});

test("Boost ranking remains internal to Event and Offer discovery", () => {
  for (const path of [
    "src/server/discovery/kudaDiscoveryFeed.ts",
    "src/server/discovery/classesDiscoveryFeed.ts",
  ]) {
    const feed = read(path);
    assert.match(feed, /getPublicationBoostLevel/);
    assert.doesNotMatch(feed, /Партнёрская рекомендация|Реклама/);
  }
});

test("Partner story labeling remains separate from Boost", () => {
  const viewer = read("src/features/stories/components/StoryViewerCard.tsx");
  const modal = read("src/features/stories/components/StoryModalActionCard.tsx");
  assert.match(viewer, /item\.isPromoted/);
  assert.match(modal, /item\.isPromoted/);
});

test("Unavailable Boost buttons are disabled before opening the dialog", () => {
  const launcher = read("src/components/business/promotion/BoostLauncher.tsx");
  assert.match(launcher, /disabled={disabled \|\| coolingDown}/);
  assert.match(launcher, /cooldownUntil/);
  assert.match(launcher, /setInterval\(update, 15_000\)/);
  assert.match(launcher, /if \(disabled \|\| coolingDown\) return/);
  assert.match(launcher, /disabled={!item\.eligible \|\| Boolean\(item\.activeBoostUntil\)}/);

  const eventsPage = read("src/app/business/(protected)/events/page.tsx");
  const eventCard = read("src/components/business/events/EventCardHorizontal.tsx");
  assert.match(eventsPage, /getFreeBoostDialogState/);
  assert.match(eventsPage, /boostNextFreeAt: freeBoost.nextFreeAt/);
  assert.match(eventCard, /disabled={activity\.boostDisabled !== false/);
  assert.match(eventCard, /cooldownUntil={activity\.boostNextFreeAt}/);

  const offersPage = read("src/app/business/(protected)/offers/page.tsx");
  const offerCard = read("src/components/business/offers/OfferCardHorizontal.tsx");
  assert.match(offersPage, /getFreeBoostDialogState/);
  assert.match(offersPage, /boostNextFreeAt: freeBoost.nextFreeAt/);
  assert.match(offerCard, /disabled={offer\.boostDisabled !== false}/);
  assert.match(offerCard, /cooldownUntil={offer\.boostNextFreeAt}/);

  const dashboard = read("src/components/business/dashboard/DailyFreeBoostCard.tsx");
  assert.match(dashboard, /disabled={disabled}/);
  assert.match(dashboard, /cooldownUntil={data\.nextFreeAt}/);
  assert.doesNotMatch(dashboard, /Почему нет публикаций\?|Проверить доступность публикаций/);
});


test("Boost countdown uses local clock and is precise at minute boundaries", () => {
  const now = Date.parse("2026-11-17T12:00:00.000Z");
  const deadline = "2026-11-18T12:00:00.000Z";
  assert.equal(formatBoostCountdown(getBoostRemainingMinutes(deadline, now)), "24:00");
  assert.equal(formatBoostCountdown(getBoostRemainingMinutes(deadline, now + 60_000)), "23:59");
  assert.equal(formatBoostCountdown(getBoostRemainingMinutes(deadline, now + 23 * 60 * 60_000)), "01:00");
  assert.equal(formatBoostCountdown(getBoostRemainingMinutes(deadline, now + 24 * 60 * 60_000 - 1)), "00:01");
  assert.equal(formatBoostCountdown(getBoostRemainingMinutes(deadline, now + 24 * 60 * 60_000)), "00:00");
  assert.equal(getBoostRemainingMinutes(deadline, now + 26 * 60 * 60_000), 0);
  assert.equal(getBoostRemainingMinutes("invalid", now), 0);
});
