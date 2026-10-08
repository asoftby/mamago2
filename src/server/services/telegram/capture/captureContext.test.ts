import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { loadCaptureContext, type CaptureContextDeps } from "./captureContext";
import { normalizeText, tokenize } from "./captureText";
import { resolveOwnerCity } from "./ownerCity";
import { rankPlaceCandidates, resolvePlaceCandidates } from "./placeCandidates";

const owner = { userId: "owner-1" };

function row(id: string, title: string, address = "ул. Тестовая, 1") {
  return { id, title, shortAddress: address, formattedAddr: null, customAddress: null };
}

test("normalization: case, ё/е, punctuation and spacing", () => {
  assert.equal(normalizeText("  Музей «Ёлки-Палки»,  №5! "), "музей елки палки 5");
  assert.deepEqual(tokenize("Поездка в Мир-Замок на 9 октября", { dropStopWords: true }), [
    "поездка", "мир", "замок", "9", "октября",
  ]);
  assert.equal(normalizeText("Ёж"), normalizeText("еж"));
});

test("place ranking: exact normalized title beats fuzzy token matches", () => {
  const rows = [
    row("fuzzy", "Музей истории театра и кино"),
    row("exact", "Музей истории"),
    row("other", "Парк Горького"),
  ];
  const ranked = rankPlaceCandidates(rows, "Едем в музей истории, сбор у входа");
  assert.equal(ranked[0]!.id, "exact");
  assert.equal(ranked[0]!.exact, true);
  assert.ok(!ranked.some((place) => place.id === "other"));
});

test("place ranking: multiple candidates, longest exact title first, capped at 5", () => {
  const rows = [
    row("a", "Зоопарк"),
    row("b", "Минский зоопарк"),
    ...Array.from({ length: 8 }, (_, i) => row(`z${i}`, `Зоопарк Номер ${i}`)),
  ];
  const ranked = rankPlaceCandidates(rows, "Экскурсия в Минский зоопарк завтра");
  assert.equal(ranked[0]!.id, "b");
  assert.equal(ranked[1]!.id, "a");
  assert.ok(ranked.length <= 5);
});

test("place ranking: ё/е and punctuation do not break an exact match", () => {
  const ranked = rankPlaceCandidates([row("e", "Ёлка: центр досуга")], "Сбор в елка центр досуга в 10:00");
  assert.deepEqual(ranked.map((place) => [place.id, place.exact]), [["e", true]]);
});

test("place ranking: a single shared word is not enough; empty text and stop-word-only titles give nothing", () => {
  assert.deepEqual(rankPlaceCandidates([row("p", "Парк Челюскинцев")], "идём в парк"), []);
  assert.deepEqual(rankPlaceCandidates([row("p", "Парк")], ""), []);
  assert.deepEqual(rankPlaceCandidates([row("s", "На в")], "на в"), []);
});

test("resolvePlaceCandidates scopes the query to the city and the public filter, and skips empty input", async () => {
  const calls: Array<{ where: Prisma.PlaceWhereInput; take?: number }> = [];
  const db = {
    place: {
      findMany: async (args: { where: Prisma.PlaceWhereInput; take?: number }) => {
        calls.push(args);
        return [row("exact", "Музей истории")];
      },
    },
  };
  const publicPlaceWhere: Prisma.PlaceWhereInput = { status: "PUBLISHED", archivedAt: null };
  const found = await resolvePlaceCandidates({ db: db as never, publicPlaceWhere }, owner, "city-minsk", "Музей истории завтра");
  assert.equal(found.length, 1);
  assert.deepEqual(calls[0]!.where, { AND: [publicPlaceWhere, { cityId: "city-minsk" }] });

  assert.deepEqual(await resolvePlaceCandidates({ db: db as never, publicPlaceWhere }, owner, null, "Музей истории"), []);
  assert.deepEqual(await resolvePlaceCandidates({ db: db as never, publicPlaceWhere }, owner, "city-minsk", "   "), []);
  assert.equal(calls.length, 1, "no query without a city or text");
});

test("owner city falls back to Minsk (no authoritative per-user city exists) for any owner", async () => {
  const asked: string[] = [];
  const deps = {
    findCityIdBySlug: async (slug: string) => {
      asked.push(slug);
      return slug === "minsk" ? "city-minsk" : null;
    },
  };
  assert.deepEqual(await resolveOwnerCity(deps, owner), { slug: "minsk", cityId: "city-minsk", source: "FALLBACK_MINSK" });
  assert.deepEqual(await resolveOwnerCity(deps, { userId: "someone-else" }), {
    slug: "minsk",
    cityId: "city-minsk",
    source: "FALLBACK_MINSK",
  });
  assert.deepEqual(asked, ["minsk", "minsk"]);

  const missing = await resolveOwnerCity({ findCityIdBySlug: async () => null }, owner);
  assert.equal(missing.cityId, null, "no city row means no shortlist, not a crash");
});

function contextDeps(over: { timeZone?: string | null; cityId?: string | null } = {}) {
  const planWhere: Prisma.PlanItemWhereInput[] = [];
  const db = {
    userNotificationSchedule: {
      findUnique: async () => (over.timeZone === null ? null : { timeZone: over.timeZone ?? "Europe/Warsaw" }),
    },
    child: {
      findMany: async () => [
        { id: "c1", name: "Тая", birthDate: new Date("2019-05-15T00:00:00Z"), birthPrecision: "DAY" },
        { id: "c2", name: null, birthDate: null, birthPrecision: null },
      ],
    },
    planItem: {
      findMany: async (args: { where: Prisma.PlanItemWhereInput }) => {
        planWhere.push(args.where);
        return [{ id: "p1", title: "Экскурсия", childId: "c1", startsAt: new Date("2026-10-09T06:30:00Z") }];
      },
    },
    place: { findMany: async () => [row("exact", "Музей истории")] },
  };
  const deps: CaptureContextDeps = {
    db: db as never,
    city: { findCityIdBySlug: async () => (over.cityId === undefined ? "city-minsk" : over.cityId) },
    places: { publicPlaceWhere: { status: "PUBLISHED" } },
  };
  return { deps, planWhere };
}

test("context: time zone, children {id,name,age}, plan candidate window and place shortlist", async () => {
  const { deps, planWhere } = contextDeps();
  const anchorAt = new Date("2026-10-01T10:00:00Z");
  const ctx = await loadCaptureContext(deps, owner, { anchorAt, anchorIsForward: true, text: "Музей истории 9 октября" });

  assert.equal(ctx.timeZone, "Europe/Warsaw");
  assert.deepEqual(ctx.children, [
    { id: "c1", name: "Тая", age: 7 },
    { id: "c2", name: null, age: null },
  ]);
  assert.deepEqual(ctx.planCandidates, [{ id: "p1", title: "Экскурсия", childId: "c1", startsAt: new Date("2026-10-09T06:30:00Z") }]);
  assert.deepEqual(Object.keys(ctx.children[0]!).sort(), ["age", "id", "name"], "no extra child fields reach the model");
  assert.equal(ctx.placeShortlist[0]!.id, "exact");
  assert.equal(ctx.city.source, "FALLBACK_MINSK");

  const where = planWhere[0] as { userId: string; source: string; cancelledAt: null; startsAt: { gte: Date; lte: Date } };
  assert.equal(where.userId, "owner-1");
  assert.equal(where.source, "TELEGRAM_FORWARD");
  assert.equal(where.cancelledAt, null);
  assert.equal(where.startsAt.gte.getTime(), anchorAt.getTime() - 2 * 86_400_000);
  assert.equal(where.startsAt.lte.getTime(), anchorAt.getTime() + 30 * 86_400_000);
});

test("context: missing or invalid time zone falls back to Europe/Minsk; no city means an empty shortlist", async () => {
  const input = { anchorAt: new Date("2026-10-01T10:00:00Z"), anchorIsForward: false, text: "Музей истории" };
  assert.equal((await loadCaptureContext(contextDeps({ timeZone: null }).deps, owner, input)).timeZone, "Europe/Minsk");
  assert.equal((await loadCaptureContext(contextDeps({ timeZone: "Not/AZone" }).deps, owner, input)).timeZone, "Europe/Minsk");
  const noCity = await loadCaptureContext(contextDeps({ cityId: null }).deps, owner, input);
  assert.deepEqual(noCity.placeShortlist, []);
});
