import assert from "node:assert/strict";
import test from "node:test";
import { PlanEntryType, PlanItemSource } from "@prisma/client";
import {
  buildFamilyCalendarItemPresentation,
  filterFamilyCalendarItems,
  findFamilyCalendarConflictIds,
} from "./familyCalendar";

const base = {
  id: "manual-a",
  source: PlanItemSource.MANUAL,
  entryType: PlanEntryType.ACTIVITY,
  title: "  Плавание  ",
  childId: "child-a",
  childName: "Аня",
  startsAt: "2026-10-03T07:00:00.000Z",
  endsAt: "2026-10-03T08:00:00.000Z",
  effectiveStartsAt: "2026-10-03T07:00:00.000Z",
  locationText: "Бассейн",
  activityId: null,
  activity: null,
};

test("one presentation adapter renders manual, catalog, and Telegram sources safely", () => {
  assert.deepEqual(buildFamilyCalendarItemPresentation(base), {
    title: "Плавание",
    typeLabel: "Занятие",
    personLabel: "Аня",
    locationLabel: "Бассейн",
    isCatalog: false,
    canEdit: true,
  });
  const catalog = buildFamilyCalendarItemPresentation({
    ...base,
    source: PlanItemSource.CATALOG,
    entryType: null,
    activityId: "activity-a",
    activity: { title: "Музей", categoryLabel: "Выставки", venueName: "Галерея" },
  });
  assert.equal(catalog.title, "Музей");
  assert.equal(catalog.locationLabel, "Галерея");
  assert.equal(catalog.canEdit, false);
  assert.equal(buildFamilyCalendarItemPresentation({
    ...base,
    source: PlanItemSource.TELEGRAM_FORWARD,
    entryType: null,
    childId: null,
    childName: null,
  }).typeLabel, "Из Telegram");
});

test("family filters distinguish all, family, and each child", () => {
  const items = [{ id: "family", childId: null }, { id: "a", childId: "a" }, { id: "b", childId: "b" }];
  assert.deepEqual(filterFamilyCalendarItems(items, "all").map((item) => item.id), ["family", "a", "b"]);
  assert.deepEqual(filterFamilyCalendarItems(items, "family").map((item) => item.id), ["family"]);
  assert.deepEqual(filterFamilyCalendarItems(items, "child:a").map((item) => item.id), ["a"]);
});

test("conflicts require the same date and same family/child scope with two real intervals", () => {
  const conflicts = findFamilyCalendarConflictIds([
    { id: "a", date: "2026-10-03", childId: "a", startsAt: "2026-10-03T07:00:00Z", endsAt: "2026-10-03T09:00:00Z" },
    { id: "b", date: "2026-10-03", childId: "a", startsAt: "2026-10-03T08:00:00Z", endsAt: "2026-10-03T10:00:00Z" },
    { id: "boundary", date: "2026-10-03", childId: "a", startsAt: "2026-10-03T10:00:00Z", endsAt: "2026-10-03T11:00:00Z" },
    { id: "other-child", date: "2026-10-03", childId: "b", startsAt: "2026-10-03T08:00:00Z", endsAt: "2026-10-03T10:00:00Z" },
    { id: "untimed", date: "2026-10-03", childId: "a", startsAt: null, endsAt: null },
  ]);
  assert.deepEqual([...conflicts].sort(), ["a", "b"]);
});
