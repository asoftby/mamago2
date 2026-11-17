import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import prisma from "@/lib/prisma";
import {
  getBusinessEventsList,
  resolveBoostState,
  resolveDisplayOccurrenceAt,
  resolveEventTemporalState,
} from "./businessEventsList.service";
import { resolvePublicationDisplayStatus } from "@/lib/publication/displayStatus";

const DAY = 24 * 60 * 60 * 1000;
const prefix = `business-events-list-${Date.now()}`;
const now = new Date();
const at = (days: number) => new Date(now.getTime() + days * DAY);

let ownerUserId = "";
let businessId = "";
let foreignUserId = "";
let foreignBusinessId = "";
const ids: Record<string, string> = {};

async function createEvent(
  key: string,
  data: {
    nextOccurrenceAt: Date | null;
    sessions: Array<{ startsAt: Date; withdrawn?: boolean }>;
    businessId?: string | null;
    ownerUserId?: string;
    status?: "PUBLISHED" | "DRAFT";
  },
) {
  const activity = await prisma.activity.create({
    data: {
      ownerUserId: data.ownerUserId ?? ownerUserId,
      businessId: data.businessId === undefined ? businessId : data.businessId,
      title: `${prefix} ${key}`,
      shortDesc: "business events list fixture",
      type: "EVENT",
      status: data.status ?? "PUBLISHED",
      scheduleMode: "MULTI_DATE",
      schedulingKind: "SLOT",
      scheduleJson: { durationMinutes: 60 },
      nextOccurrenceAt: data.nextOccurrenceAt,
      sessions: {
        create: data.sessions.map((session) => ({
          startsAt: session.startsAt,
          withdrawnAt: session.withdrawn ? now : null,
        })),
      },
    },
    select: { id: true },
  });
  ids[key] = activity.id;
}

async function list() {
  const rows = await getBusinessEventsList({ userId: ownerUserId, businessId, view: "active", now });
  return new Map(rows.map((row) => [row.id, row]));
}

test.before(async () => {
  const owner = await prisma.user.create({
    data: { email: `${prefix}-owner@example.invalid`, role: "BUSINESS_OWNER" },
  });
  ownerUserId = owner.id;
  businessId = (
    await prisma.business.create({
      data: { name: `${prefix} business`, ownerUserId, status: "APPROVED", operationalStatus: "ACTIVE" },
    })
  ).id;
  const foreign = await prisma.user.create({
    data: { email: `${prefix}-foreign@example.invalid`, role: "BUSINESS_OWNER" },
  });
  foreignUserId = foreign.id;
  foreignBusinessId = (
    await prisma.business.create({
      data: { name: `${prefix} foreign`, ownerUserId: foreignUserId, status: "APPROVED", operationalStatus: "ACTIVE" },
    })
  ).id;

  // Устаревший nextOccurrenceAt (26.09-подобный), все сеансы уже прошли.
  await createEvent("past", {
    nextOccurrenceAt: at(-60),
    sessions: [{ startsAt: at(-60) }, { startsAt: at(-20) }],
  });
  await createEvent("future", {
    nextOccurrenceAt: at(2),
    sessions: [{ startsAt: at(-3) }, { startsAt: at(2) }, { startsAt: at(9) }],
  });
  await createEvent("future2", { nextOccurrenceAt: at(5), sessions: [{ startsAt: at(5) }] });
  // Будущий сеанс отозван: событие фактически прошло.
  await createEvent("withdrawnFuture", {
    nextOccurrenceAt: at(4),
    sessions: [{ startsAt: at(-5) }, { startsAt: at(4), withdrawn: true }],
  });
  await createEvent("noSessions", { nextOccurrenceAt: at(7), sessions: [] });
  // Создано этим пользователем, но привязано к чужому бизнесу.
  await createEvent("foreignBusiness", {
    nextOccurrenceAt: at(3),
    sessions: [{ startsAt: at(3) }],
    businessId: foreignBusinessId,
  });
});

test.after(async () => {
  const activityIds = Object.values(ids);
  await prisma.boost.deleteMany({ where: { businessId: { in: [businessId, foreignBusinessId] } } });
  await prisma.activity.deleteMany({ where: { id: { in: activityIds } } });
  await prisma.business.deleteMany({ where: { id: { in: [businessId, foreignBusinessId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerUserId, foreignUserId] } } });
  await prisma.$disconnect();
});

test("pure helpers: fallback chain and temporal state", () => {
  const stale = at(-60);
  assert.equal(
    resolveDisplayOccurrenceAt({ lastSessionStart: at(-20), nextSessionStart: null }, stale)?.getTime(),
    at(-20).getTime(),
  );
  assert.equal(
    resolveDisplayOccurrenceAt({ lastSessionStart: at(-20), nextSessionStart: at(2) }, stale)?.getTime(),
    at(2).getTime(),
  );
  assert.equal(
    resolveDisplayOccurrenceAt({ lastSessionStart: null, nextSessionStart: null }, stale)?.getTime(),
    stale.getTime(),
  );
  assert.equal(resolveDisplayOccurrenceAt({ lastSessionStart: null, nextSessionStart: null }, null), null);
  assert.equal(
    resolveEventTemporalState({
      scheduleMode: "MULTI_DATE",
      nextOccurrenceAt: at(9),
      sessions: { lastSessionStart: at(-1), nextSessionStart: null },
      now,
    }),
    "PAST",
  );
});

test("pure helpers: boost state is server-computed and conservative", () => {
  const candidate = (over: Record<string, unknown>) => ({
    id: "x", title: "x", publicationType: "EVENT" as const, activeBoostUntil: null,
    activeFreeBoostUntil: null, eligible: true, reason: null, ...over,
  });
  assert.equal(resolveBoostState({ availableToday: true, candidate: candidate({}) }).boostDisabled, false);
  assert.equal(resolveBoostState({ availableToday: false, candidate: candidate({}) }).boostDisabled, true);
  assert.equal(resolveBoostState({ availableToday: true, candidate: candidate({ eligible: false }) }).boostDisabled, true);
  assert.equal(resolveBoostState({ availableToday: true, candidate: undefined }).boostDisabled, true);
  const active = resolveBoostState({
    availableToday: true,
    candidate: candidate({ activeBoostUntil: "2026-01-01T00:00:00.000Z", activeFreeBoostUntil: "2026-01-01T00:00:00.000Z" }),
  });
  assert.equal(active.boostDisabled, true);
  assert.equal(active.boostNextFreeAt, "2026-01-01T00:00:00.000Z");
});

test("elapsed event: PAST, last session date, display status 'Уже прошло', no boost", async () => {
  const row = (await list()).get(ids.past)!;
  assert.equal(row.temporalState, "PAST");
  assert.equal(row.displayOccurrenceAt?.getTime(), at(-20).getTime());
  assert.equal(
    resolvePublicationDisplayStatus({ status: row.status, temporalState: row.temporalState }).label,
    "Уже прошло",
  );
  assert.equal(row.status, "PUBLISHED", "DB status is not rewritten");
  assert.equal(row.boostDisabled, true);
});

test("event with future sessions: UPCOMING, nearest future date, boost available", async () => {
  const row = (await list()).get(ids.future)!;
  assert.equal(row.temporalState, "UPCOMING");
  assert.equal(row.displayOccurrenceAt?.getTime(), at(2).getTime());
  assert.equal(
    resolvePublicationDisplayStatus({ status: row.status, temporalState: row.temporalState }).label,
    "Активно",
  );
  assert.equal(row.boostDisabled, false);
  assert.equal(row.boostNextFreeAt, null);
});

test("withdrawn sessions do not count as availability", async () => {
  const row = (await list()).get(ids.withdrawnFuture)!;
  assert.equal(row.temporalState, "PAST");
  assert.equal(row.displayOccurrenceAt?.getTime(), at(-5).getTime());
});

test("no sessions: falls back to nextOccurrenceAt", async () => {
  const row = (await list()).get(ids.noSessions)!;
  assert.equal(row.displayOccurrenceAt?.getTime(), at(7).getTime());
  assert.equal(row.temporalState, "UPCOMING");
});

test("event attached to another Business is listed but never gets free Boost", async () => {
  const row = (await list()).get(ids.foreignBusiness)!;
  assert.ok(row, "listed through ownerUserId");
  assert.equal(row.boostDisabled, true);
});

test("active free Boost: timer on the boosted event only, quota blocks the rest", async () => {
  await prisma.boost.create({
    data: {
      businessId,
      activityId: ids.future,
      startAt: new Date(now.getTime() - 60 * 60 * 1000),
      endAt: new Date(now.getTime() + 23 * 60 * 60 * 1000),
      durationDays: 1,
      price: 0,
      currency: "BYN",
      isFreeDaily: true,
      freeDailyDateKey: `${prefix}-key`,
    },
  });
  const rows = await list();
  const boosted = rows.get(ids.future)!;
  assert.equal(boosted.boostDisabled, true);
  assert.ok(boosted.boostNextFreeAt, "countdown only on the selected publication");
  assert.equal(boosted.isPromoted, true);
  const other = rows.get(ids.future2)!;
  assert.equal(other.boostDisabled, true, "quota exhausted");
  assert.equal(other.boostNextFreeAt, null, "no timer on other publications");
});

test("both routes and /me/events use the single server loader", () => {
  const pages = [
    "src/app/business/(protected)/events/page.tsx",
    "src/app/business/(protected)/publications/events/page.tsx",
    "src/app/(public)/me/events/page.tsx",
  ];
  for (const page of pages) {
    const source = readFileSync(page, "utf8");
    assert.ok(source.includes("getBusinessEventsList("), `${page} must use getBusinessEventsList`);
    assert.ok(!source.includes("prisma.activity.findMany"), `${page} must not query activities itself`);
  }
});
