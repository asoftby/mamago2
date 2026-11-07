/**
 * Mock catalog for testing the day-scenario engine (BACKLOG-230). DEV ONLY.
 *
 *   node dist/ops/seed-day-scenario-mocks.js --plan                          # print the plan, no database
 *   node dist/ops/seed-day-scenario-mocks.js --check   --confirm-host=<db host>
 *   node dist/ops/seed-day-scenario-mocks.js --apply   --confirm-host=<db host> [--owner-email=<email>]
 *   node dist/ops/seed-day-scenario-mocks.js --cleanup --confirm-host=<db host>
 *   (locally: pnpm seed:day-scenario-mocks -- --plan)
 *
 * Everything it creates is marked: title prefix "[MOCK]", slug prefix "mock-dsm-", and
 * Place.source = "day-scenario-mock". --cleanup removes exactly those rows (and any plan
 * items that reference them). --apply is idempotent: it updates in place and re-creates
 * the sessions relative to the apply date. It refuses to touch a database unless
 * APP_ENV is dev/local and --confirm-host equals the database host.
 *
 * Writes use the plain Prisma client (no search indexing): mocks are visible to the
 * public listing predicates and to the engine, not to the search index.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";
import { geoCellsFor } from "../../src/lib/geo/geoCell";
import { CLUSTER_LABEL, MOCK_PLACES, type ClusterKey, type MockPlaceSpec } from "./day-scenario-mocks/places.data";
import { DAY_SLOTS, MOCK_EVENTS, type DaySlot, type MockEventSpec } from "./day-scenario-mocks/events.data";

export const MOCK_SOURCE = "day-scenario-mock";
export const MOCK_SLUG_PREFIX = "mock-dsm-";
export const MOCK_TITLE_PREFIX = "[MOCK]";
const TZ = "Europe/Minsk";
const DEFAULT_OWNER_EMAIL = "baseline-test+20261107@mamago.by";
const HOURS_NOTE = "day-scenario-mock";

// ---------------------------------------------------------------- pure helpers

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Minsk calendar date of an instant. */
export function minskDateOf(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  return fmtDate(new Date(Date.UTC(y!, m! - 1, d! + days)));
}

function weekdayOf(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay(); // 0 = Sunday
}

/** First date strictly after `todayIso` that falls on `weekday` (0 = Sunday ... 6 = Saturday). */
function nextWeekday(todayIso: string, weekday: number): string {
  let d = addDays(todayIso, 1);
  while (weekdayOf(d) !== weekday) d = addDays(d, 1);
  return d;
}

/** The apply-date-relative calendar: next two Saturdays/Sundays and the next Wednesday. */
export function resolveSlotDates(todayIso: string): Record<DaySlot, string> {
  const sat1 = nextWeekday(todayIso, 6);
  const sat2 = addDays(sat1, 7);
  return { sat1, sun1: addDays(sat1, 1), sat2, sun2: addDays(sat2, 1), wed1: nextWeekday(todayIso, 3) };
}

export function sessionInstant(dateIso: string, time: string): Date {
  return fromZonedTime(`${dateIso}T${time}:00`, TZ);
}

export function placeSlug(key: string): string {
  return `${MOCK_SLUG_PREFIX}${key}`;
}
export function eventSlug(key: string): string {
  return `${MOCK_SLUG_PREFIX}ev-${key}`;
}

export type HoursPlan =
  | { kind: "none" }
  | { kind: "mode"; mode: "ALWAYS_OPEN" | "BY_APPOINTMENT" | "TEMPORARILY_CLOSED" }
  | {
      kind: "weekly";
      mondayOff: boolean;
      /** Date exception: closed all day, or short hours. */
      exception: { date: string; closed: boolean } | null;
    };

/** How a place's opening hours are built; date exceptions fall on this run's Saturday/Sunday. */
export function hoursPlanFor(spec: MockPlaceSpec, dates: Record<DaySlot, string>, ordinal: number): HoursPlan {
  switch (spec.hours) {
    case "none":
      return { kind: "none" };
    case "always":
      return { kind: "mode", mode: "ALWAYS_OPEN" };
    case "appointment":
      return { kind: "mode", mode: "BY_APPOINTMENT" };
    case "temp-closed":
      return { kind: "mode", mode: "TEMPORARILY_CLOSED" };
    case "monday-off":
      return { kind: "weekly", mondayOff: true, exception: null };
    case "exception":
      return { kind: "weekly", mondayOff: false, exception: ordinal % 2 === 0 ? { date: dates.sat1, closed: true } : { date: dates.sun1, closed: false } };
    default:
      return { kind: "weekly", mondayOff: false, exception: null };
  }
}

const DAY_ENUM = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

function openingHoursData(plan: HoursPlan): Prisma.OpeningHoursCreateInput | null {
  if (plan.kind === "none") return null;
  if (plan.kind === "mode") return { mode: plan.mode, timezone: TZ, note: HOURS_NOTE };
  return {
    mode: "WEEKLY",
    timezone: TZ,
    note: HOURS_NOTE,
    rules: {
      create: DAY_ENUM.map((day) => {
        const weekend = day === "SAT" || day === "SUN";
        const closed = plan.mondayOff && day === "MON";
        return {
          dayOfWeek: day,
          isOpen: !closed,
          allDay: false,
          intervals: closed ? undefined : { create: [{ startTime: weekend ? "11:00" : "10:00", endTime: weekend ? "20:00" : "19:00", sortOrder: 0 }] },
        };
      }),
    },
    exceptions: plan.exception
      ? {
          create: [
            plan.exception.closed
              ? { date: plan.exception.date, isClosed: true, allDay: false, note: HOURS_NOTE }
              : { date: plan.exception.date, isClosed: false, allDay: false, note: HOURS_NOTE, intervals: { create: [{ startTime: "12:00", endTime: "15:00", sortOrder: 0 }] } },
          ],
        }
      : undefined,
  };
}

// ---------------------------------------------------------------- plan (no database)

export function buildPlanLines(todayIso: string): string[] {
  const dates = resolveSlotDates(todayIso);
  const lines: string[] = [];
  lines.push(`apply date ${todayIso}; sat1=${dates.sat1} sun1=${dates.sun1} sat2=${dates.sat2} sun2=${dates.sun2} wed1=${dates.wed1}`);
  lines.push("");
  lines.push("PLACES (cluster | key | category | ages | hours | lat,lng | geoCell5 | geoCell6)");
  let ordinal = 0;
  for (const p of MOCK_PLACES) {
    const cells = geoCellsFor(p.lat, p.lng);
    const plan = hoursPlanFor(p, dates, ordinal++);
    const hours = plan.kind === "mode" ? plan.mode : plan.kind === "none" ? "no record" : `WEEKLY${plan.mondayOff ? " (Mon off)" : ""}${plan.exception ? ` (exc ${plan.exception.date} ${plan.exception.closed ? "closed" : "12-15"})` : ""}`;
    lines.push(`${CLUSTER_LABEL[p.cluster]} | ${p.key} | ${p.primary}${p.sub ? "/" + p.sub : ""} | ${p.adultOnly ? "18+" : p.ages.join(",") || "any"} | ${hours} | ${p.lat ?? "-"},${p.lng ?? "-"} | ${cells?.geoCell5 ?? "-"} | ${cells?.geoCell6 ?? "-"}`);
  }
  lines.push("");
  lines.push("EVENTS (cluster | key | place | mode | ages | sessions)");
  for (const e of MOCK_EVENTS) {
    const sessions = DAY_SLOTS.filter((s) => e.sessions[s]?.length).map((s) => `${s}(${dates[s]}) ${e.sessions[s]!.join("/")}`).join("; ");
    lines.push(`${CLUSTER_LABEL[e.cluster]} | ${e.key} | ${e.placeKey ?? `metro: ${e.metroLike}`} | ${e.mode} | ${e.ages.join(",")} | ${sessions || "no ActivitySession"}`);
  }
  return lines;
}

// ---------------------------------------------------------------- CLI plumbing

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function databaseHost(): string | null {
  try {
    return process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : null;
  } catch {
    return null;
  }
}

const ALLOWED_APP_ENV = new Set(["dev", "development", "local", "test"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Returns a refusal reason, or null when the run may touch the database. */
export function refusalReason(env: Readonly<Record<string, string | undefined>>, confirmHost: string | null): string | null {
  const appEnv = (env.APP_ENV ?? "").trim().toLowerCase();
  if (!ALLOWED_APP_ENV.has(appEnv)) return `APP_ENV must be dev/local (got "${appEnv || "unset"}"): this seed is DEV-only`;
  let host: string | null = null;
  try {
    host = env.DATABASE_URL ? new URL(env.DATABASE_URL).hostname : null;
  } catch {
    host = null;
  }
  if (!host) return "DATABASE_URL is missing or not a URL";
  if (!LOCAL_HOSTS.has(host) && !host.endsWith(".localhost") && confirmHost !== host) {
    return `non-local database host "${host}" requires --confirm-host=${host}`;
  }
  return null;
}

type Ctx = {
  prisma: PrismaClient;
  ownerId: string;
  cityId: string;
  cityTerritoryId: string | null;
  regionTerritoryId: string | null;
  categories: Map<string, string>;
  dates: Record<DaySlot, string>;
};

function territoryFor(ctx: Ctx, cluster: ClusterKey): string | null {
  return cluster === "bor" || cluster === "zhd" ? (ctx.regionTerritoryId ?? ctx.cityTerritoryId) : (ctx.cityTerritoryId ?? ctx.regionTerritoryId);
}

async function loadContext(prisma: PrismaClient, ownerEmail: string): Promise<Ctx | string> {
  const owner = await prisma.user.findFirst({ where: { email: { equals: ownerEmail, mode: "insensitive" } }, select: { id: true } });
  if (!owner) return `owner user "${ownerEmail}" not found (create it first or pass --owner-email=)`;
  const city = await prisma.city.findFirst({ where: { slug: "minsk" }, select: { id: true } });
  if (!city) return 'city "minsk" not found';
  const [cityTerritory, regionTerritory] = await Promise.all([
    prisma.territory.findFirst({ where: { type: "CITY", slug: "minsk" }, select: { id: true } }),
    prisma.territory.findFirst({ where: { type: "REGION", slug: "minsk" }, select: { id: true } }),
  ]);
  if (!cityTerritory && !regionTerritory) return "no Minsk territory found";
  const slugs = new Set<string>();
  for (const p of MOCK_PLACES) {
    slugs.add(p.primary);
    if (p.sub) slugs.add(p.sub);
  }
  const rows = await prisma.eventCategory.findMany({ where: { publicationType: "PLACE", slug: { in: [...slugs] } }, select: { id: true, slug: true } });
  const categories = new Map(rows.map((r) => [r.slug, r.id]));
  const missing = [...slugs].filter((s) => !categories.has(s));
  if (missing.length > 0) return `place categories missing in this database: ${missing.join(", ")}`;
  return {
    prisma,
    ownerId: owner.id,
    cityId: city.id,
    cityTerritoryId: cityTerritory?.id ?? null,
    regionTerritoryId: regionTerritory?.id ?? null,
    categories,
    dates: resolveSlotDates(minskDateOf(new Date())),
  };
}

// ---------------------------------------------------------------- apply

async function applyPlaces(ctx: Ctx): Promise<Map<string, string>> {
  const { prisma } = ctx;
  const ids = new Map<string, string>();
  let ordinal = 0;
  for (const spec of MOCK_PLACES) {
    const slug = placeSlug(spec.key);
    const cells = geoCellsFor(spec.lat, spec.lng);
    const hoursPlan = hoursPlanFor(spec, ctx.dates, ordinal++);
    const existing = await prisma.place.findFirst({ where: { cityId: ctx.cityId, slug }, select: { id: true, openingHoursId: true } });

    // Hours are replaced wholesale: detach the old record, then create the new one.
    if (existing?.openingHoursId) {
      await prisma.place.update({ where: { id: existing.id }, data: { openingHoursId: null } });
      await prisma.openingHours.deleteMany({ where: { id: existing.openingHoursId, note: HOURS_NOTE } });
    }
    const hoursData = openingHoursData(hoursPlan);
    const hours = hoursData ? await prisma.openingHours.create({ data: hoursData, select: { id: true } }) : null;

    const data = {
      title: spec.title,
      shortDesc: `${MOCK_TITLE_PREFIX} тестовое место для проверки сценария дня (${CLUSTER_LABEL[spec.cluster]})`,
      slug,
      status: "PUBLISHED" as const,
      archivedAt: null,
      source: MOCK_SOURCE,
      cityId: ctx.cityId,
      territoryId: territoryFor(ctx, spec.cluster),
      lat: spec.lat,
      lng: spec.lng,
      geoCell6: cells?.geoCell6 ?? null,
      geoCell5: cells?.geoCell5 ?? null,
      shortAddress: `Минск, ${CLUSTER_LABEL[spec.cluster]} (тестовая точка)`,
      primaryCategoryId: ctx.categories.get(spec.primary)!,
      ageTags: spec.ages,
      agePolicy: spec.adultOnly ? ("ADULT_ONLY" as const) : spec.ages.length > 0 ? ("SPECIFIC" as const) : ("UNKNOWN" as const),
      openingHoursId: hours?.id ?? null,
    };
    const saved = existing
      ? await prisma.place.update({ where: { id: existing.id }, data, select: { id: true } })
      : await prisma.place.create({ data: { ...data, createdByUserId: ctx.ownerId }, select: { id: true } });
    ids.set(spec.key, saved.id);

    if (spec.sub) {
      const subId = ctx.categories.get(spec.sub)!;
      await prisma.placeSubcategory.deleteMany({ where: { placeId: saved.id } });
      await prisma.placeSubcategory.create({ data: { placeId: saved.id, categoryId: subId } });
    }
  }
  return ids;
}

function scheduleJsonFor(spec: MockEventSpec, dates: Record<DaySlot, string>): Prisma.InputJsonValue {
  if (spec.mode === "RECURRING") {
    return {
      scheduleItems: [{ date: dates.sat1, startTime: "11:00", recurringEnabled: true, recurrenceInterval: 1, recurrenceUnit: "week", recurrenceUntil: addDays(dates.sat1, 90) }],
    };
  }
  const items: { date: string; startTime: string }[] = [];
  for (const slot of DAY_SLOTS) for (const time of spec.sessions[slot] ?? []) items.push({ date: dates[slot], startTime: time });
  return { dates: [...new Set(items.map((i) => i.date))], startTime: items[0]?.startTime ?? "10:00", scheduleItems: items };
}

async function applyEvents(ctx: Ctx, placeIds: Map<string, string>): Promise<{ created: number; warnings: string[] }> {
  const { prisma } = ctx;
  const warnings: string[] = [];
  let count = 0;
  for (const spec of MOCK_EVENTS) {
    const slug = eventSlug(spec.key);
    let placeId: string | null = null;
    let metroStationId: string | null = null;
    if (spec.placeKey) {
      placeId = placeIds.get(spec.placeKey) ?? null;
      if (!placeId) {
        warnings.push(`event ${spec.key}: place ${spec.placeKey} missing`);
        continue;
      }
    } else if (spec.metroLike) {
      const station = await prisma.metroStation.findFirst({ where: { name: { contains: spec.metroLike, mode: "insensitive" } }, select: { id: true } });
      if (!station) {
        warnings.push(`event ${spec.key}: metro station like "${spec.metroLike}" not found, event skipped`);
        continue;
      }
      metroStationId = station.id;
    }

    const instants: Date[] = [];
    for (const slot of DAY_SLOTS) for (const time of spec.sessions[slot] ?? []) instants.push(sessionInstant(ctx.dates[slot], time));
    instants.sort((a, b) => a.getTime() - b.getTime());

    const data = {
      title: spec.title,
      slug,
      shortDesc: `${MOCK_TITLE_PREFIX} тестовое событие для проверки сценария дня (${CLUSTER_LABEL[spec.cluster]})`,
      type: "EVENT" as const,
      status: "PUBLISHED" as const,
      format: "OFFLINE" as const,
      scheduleMode: spec.mode,
      scheduleJson: scheduleJsonFor(spec, ctx.dates),
      priceMode: "FREE" as const,
      cityId: ctx.cityId,
      territoryId: territoryFor(ctx, spec.cluster),
      placeId,
      metroStationId,
      ageTags: spec.ages,
      agePolicy: "SPECIFIC" as const,
      nextOccurrenceAt: instants[0] ?? null,
    };
    const existing = await prisma.activity.findFirst({ where: { slug, title: { startsWith: MOCK_TITLE_PREFIX } }, select: { id: true } });
    const saved = existing
      ? await prisma.activity.update({ where: { id: existing.id }, data, select: { id: true } })
      : await prisma.activity.create({ data: { ...data, ownerUserId: ctx.ownerId }, select: { id: true } });

    // Sessions are re-created relative to this run's dates; RECURRING keeps none by design.
    await prisma.activitySession.deleteMany({ where: { activityId: saved.id } });
    if (instants.length > 0) {
      await prisma.activitySession.createMany({ data: instants.map((startsAt) => ({ activityId: saved.id, startsAt, source: MOCK_SOURCE })) });
    }
    count += 1;
  }
  return { created: count, warnings };
}

// ---------------------------------------------------------------- cleanup / check

async function cleanup(prisma: PrismaClient): Promise<void> {
  const acts = await prisma.activity.findMany({ where: { slug: { startsWith: MOCK_SLUG_PREFIX }, title: { startsWith: MOCK_TITLE_PREFIX } }, select: { id: true } });
  const places = await prisma.place.findMany({ where: { slug: { startsWith: MOCK_SLUG_PREFIX }, source: MOCK_SOURCE, title: { startsWith: MOCK_TITLE_PREFIX } }, select: { id: true, openingHoursId: true } });
  const actIds = acts.map((a) => a.id);
  const placeIds = places.map((p) => p.id);
  // Plan entries that point at mock rows, plus the "[MOCK]" manual notes the test matrix adds.
  const planItems = await prisma.planItem.deleteMany({
    where: { OR: [{ activityId: { in: actIds } }, { placeId: { in: placeIds } }, { title: { startsWith: MOCK_TITLE_PREFIX } }] },
  });
  const sessions = await prisma.activitySession.deleteMany({ where: { activityId: { in: actIds } } });
  const activities = await prisma.activity.deleteMany({ where: { id: { in: actIds } } });
  await prisma.placeSubcategory.deleteMany({ where: { placeId: { in: placeIds } } });
  const pl = await prisma.place.deleteMany({ where: { id: { in: placeIds } } });
  const hours = await prisma.openingHours.deleteMany({ where: { note: HOURS_NOTE } });
  console.log(JSON.stringify({ cleanup: { planItems: planItems.count, sessions: sessions.count, activities: activities.count, places: pl.count, openingHours: hours.count } }));
}

async function check(ctx: Ctx): Promise<boolean> {
  const { prisma } = ctx;
  let ok = true;
  const line = (name: string, pass: boolean, detail: string) => {
    ok = ok && pass;
    console.log(`${pass ? "PASS" : "FAIL"} ${name} ${detail}`);
  };
  const places = await prisma.place.findMany({
    where: { slug: { startsWith: MOCK_SLUG_PREFIX }, source: MOCK_SOURCE },
    select: { slug: true, lat: true, lng: true, geoCell6: true, geoCell5: true, status: true, openingHours: { select: { mode: true } } },
  });
  line("places", places.length === MOCK_PLACES.length, `${places.length}/${MOCK_PLACES.length}`);
  const badCells = places.filter((p) => {
    const c = geoCellsFor(p.lat, p.lng);
    return (c?.geoCell6 ?? null) !== p.geoCell6 || (c?.geoCell5 ?? null) !== p.geoCell5;
  });
  line("geoCell consistent", badCells.length === 0, `${badCells.length} mismatches`);
  line("all published", places.every((p) => p.status === "PUBLISHED"), "");
  const modes = new Set(places.map((p) => p.openingHours?.mode ?? "NONE"));
  line("hours variants", ["WEEKLY", "ALWAYS_OPEN", "BY_APPOINTMENT", "TEMPORARILY_CLOSED", "NONE"].every((m) => modes.has(m as never)), [...modes].join(","));
  const events = await prisma.activity.findMany({
    where: { slug: { startsWith: MOCK_SLUG_PREFIX }, title: { startsWith: MOCK_TITLE_PREFIX } },
    select: { slug: true, scheduleMode: true, _count: { select: { sessions: true } }, sessions: { select: { startsAt: true }, orderBy: { startsAt: "asc" }, take: 1 } },
  });
  line("events", events.length >= MOCK_EVENTS.length - 1, `${events.length}/${MOCK_EVENTS.length} (the metro event is skipped without a station)`);
  const recurring = events.find((e) => e.scheduleMode === "RECURRING");
  line("recurring without sessions", Boolean(recurring) && recurring!._count.sessions === 0, "");
  const past = events.filter((e) => e.scheduleMode !== "RECURRING" && (e.sessions[0]?.startsAt.getTime() ?? 0) < Date.now());
  line("sessions are in the future", past.length === 0, `${past.length} events start in the past (re-run --apply)`);
  console.log(`MOCK_CHECK ${ok ? "PASS" : "FAIL"}`);
  return ok;
}

async function main(): Promise<number> {
  if (has("--help") || args.length === 0) {
    console.log("seed-day-scenario-mocks --plan | --check | --apply | --cleanup  [--confirm-host=DB_HOST] [--owner-email=EMAIL]");
    return 0;
  }
  if (has("--plan")) {
    console.log(buildPlanLines(minskDateOf(new Date())).join("\n"));
    return 0;
  }
  const reason = refusalReason(process.env, argValue("confirm-host"));
  if (reason) {
    console.log(`MOCK_SEED REFUSED: ${reason}`);
    return 2;
  }
  const prisma = new PrismaClient();
  try {
    console.log(`target database host: ${databaseHost()} (APP_ENV=${process.env.APP_ENV})`);
    if (has("--cleanup")) {
      await cleanup(prisma);
      return 0;
    }
    const ctx = await loadContext(prisma, argValue("owner-email") ?? DEFAULT_OWNER_EMAIL);
    if (typeof ctx === "string") {
      console.log(`MOCK_SEED REFUSED: ${ctx}`);
      return 2;
    }
    if (has("--check")) return (await check(ctx)) ? 0 : 1;
    if (has("--apply")) {
      const placeIds = await applyPlaces(ctx);
      const events = await applyEvents(ctx, placeIds);
      console.log(JSON.stringify({ applied: { places: placeIds.size, events: events.created, dates: ctx.dates }, warnings: events.warnings }));
      return (await check(ctx)) ? 0 : 1;
    }
    console.log("nothing to do: pass --plan, --check, --apply or --cleanup");
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}
