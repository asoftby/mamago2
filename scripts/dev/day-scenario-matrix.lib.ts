/**
 * Pure analysis + HTML rendering for the day-scenario test matrix (BACKLOG-230).
 * No I/O: the runner feeds it API responses, the oracle comes from the mock seed specs,
 * so violations are judged against what the seed *says* (independent of the engine).
 */
import { geoCellsFor, geoCellWithNeighbors } from "../../src/lib/geo/geoCell";
import { haversineMeters } from "../../src/lib/geo/haversineMeters";
import { ageRangeAt } from "../../src/lib/child/birth";
import { CLUSTER_LABEL, MOCK_PLACES, type MockPlaceSpec } from "../ops/day-scenario-mocks/places.data";
import { MOCK_EVENTS } from "../ops/day-scenario-mocks/events.data";
import { hoursPlanFor, sessionInstant, type HoursPlan } from "../ops/seed-day-scenario-mocks";
import type { DaySlot } from "../ops/day-scenario-mocks/events.data";

/** Child fields the oracle needs, as returned by GET /api/children. */
export type OracleChild = { birthDate?: string | null; birthPrecision?: "DAY" | "MONTH" | null };

/**
 * Age ranges the audience has on `date`, derived from the children's birth data with the same
 * canonical function the server uses. Independent of the engine response, so age violations
 * are judged for authenticated audiences too. Throws when nothing can be derived: an empty
 * oracle would silently skip every age check.
 */
export function oracleAgeRanges(children: readonly OracleChild[], date: string): string[] {
  const target = new Date(`${date}T12:00:00.000Z`);
  const ranges = new Set<string>();
  for (const child of children) {
    if (!child.birthDate) continue;
    const range = ageRangeAt({ birthDate: new Date(child.birthDate), birthPrecision: child.birthPrecision ?? null }, target);
    if (range) ranges.add(range);
  }
  if (ranges.size === 0) throw new Error(`cannot derive age ranges for ${date}: children have no usable birth data`);
  return [...ranges];
}

export const TODDLER_RANGES = new Set(["0-1", "1-3"]);

export const PLAN_FIXTURE_TITLE = "[MOCK] Запись плана 12:00";

export type ApiItem = {
  kind?: "event" | "place";
  hoursUnconfirmed?: boolean;
  scheduleUnconfirmed?: boolean;
  activityId: string;
  card: { title: string; categoryName?: string | null; address?: string | null };
  startsAt: string;
  endsAt: string;
  pinned?: boolean;
  travel: { mode: string; minutes: number; distanceM: number } | null;
  approximatePlace: boolean;
  far: boolean;
};
export type ApiResult = { variant?: number; status: string; mode: string; suggestMode: string | null; items: ApiItem[]; exhausted?: boolean; alternatives?: ApiItem[][]; meta?: { poolCache?: string; poolSize?: number; poolPlaces?: number; candidateCount?: number; buildMs?: number } };

export type RunParams = {
  id: string;
  date: string;
  dateLabel: string;
  mode: "walk" | "car";
  audience: string;
  ageRanges: string[];
  toddler: boolean;
  window: { start: string; end: string };
  planItem: boolean;
};

export type SpecInfo = {
  title: string;
  kind: "event" | "place";
  cluster: string;
  clusterLabel: string;
  lat: number | null;
  lng: number | null;
  geoCell5: string | null;
  geoCell6: string | null;
  ages: string[];
  adultOnly: boolean;
  placeSpec: MockPlaceSpec | null;
  placeOrdinal: number;
};

const placeByTitle = new Map(MOCK_PLACES.map((p, i) => [p.title, { p, i }]));
const placeByKey = new Map(MOCK_PLACES.map((p) => [p.key, p]));

/** Resolve a returned card title to the seed spec it came from (events inherit their place's position). */
export function specFor(title: string): SpecInfo | null {
  const place = placeByTitle.get(title);
  if (place) {
    const c = geoCellsFor(place.p.lat, place.p.lng);
    return { title, kind: "place", cluster: place.p.cluster, clusterLabel: CLUSTER_LABEL[place.p.cluster], lat: place.p.lat, lng: place.p.lng, geoCell5: c?.geoCell5 ?? null, geoCell6: c?.geoCell6 ?? null, ages: place.p.ages, adultOnly: place.p.adultOnly, placeSpec: place.p, placeOrdinal: place.i };
  }
  const event = MOCK_EVENTS.find((e) => e.title === title);
  if (!event) return null;
  const venue = event.placeKey ? placeByKey.get(event.placeKey) ?? null : null;
  const c = venue ? geoCellsFor(venue.lat, venue.lng) : null;
  return { title, kind: "event", cluster: event.cluster, clusterLabel: CLUSTER_LABEL[event.cluster], lat: venue?.lat ?? null, lng: venue?.lng ?? null, geoCell5: c?.geoCell5 ?? null, geoCell6: c?.geoCell6 ?? null, ages: event.ages, adultOnly: false, placeSpec: null, placeOrdinal: -1 };
}

// ------------------------------------------------------------ opening-hours oracle

function dayOfWeek(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

/** Open windows (epoch ms) a seeded place has on `dateIso`, or "always" / "unknown" / "closed". */
export function seededAvailability(plan: HoursPlan, dateIso: string): "always" | "unknown" | "closed" | { startMs: number; endMs: number }[] {
  if (plan.kind === "none") return "unknown";
  if (plan.kind === "mode") return plan.mode === "ALWAYS_OPEN" ? "always" : "closed";
  const dow = dayOfWeek(dateIso); // 0 = Sunday
  if (plan.exception && plan.exception.date === dateIso) {
    if (plan.exception.closed) return "closed";
    return [{ startMs: sessionInstant(dateIso, "12:00").getTime(), endMs: sessionInstant(dateIso, "15:00").getTime() }];
  }
  if (plan.mondayOff && dow === 1) return "closed";
  const weekend = dow === 0 || dow === 6;
  return [{ startMs: sessionInstant(dateIso, weekend ? "11:00" : "10:00").getTime(), endMs: sessionInstant(dateIso, weekend ? "20:00" : "19:00").getTime() }];
}

// ------------------------------------------------------------ analysis

export type Violation = { run: string; step: string; rule: string; detail: string };

export type Totals = { points: number; km: number; travelMin: number; cell5Transitions: number };

export function totalsOf(items: ApiItem[]): Totals {
  let km = 0;
  let travelMin = 0;
  for (const i of items) {
    if (i.travel) {
      km += i.travel.distanceM / 1000;
      travelMin += i.travel.minutes;
    }
  }
  const cells = items.map((i) => specFor(i.card.title)?.geoCell5 ?? null);
  let cell5Transitions = 0;
  for (let k = 1; k < cells.length; k++) if (cells[k] && cells[k - 1] && cells[k] !== cells[k - 1]) cell5Transitions += 1;
  return { points: items.length, km: Math.round(km * 100) / 100, travelMin, cell5Transitions };
}

const hm = (iso: string) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Minsk", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** What a step is, for the repeat rules: only "another" steps are judged for repeats. */
export type StepKind = "build" | "another" | "alternative" | "other";

export type CheckContext = {
  dates: Record<DaySlot, string>;
  stepKind?: StepKind;
  /** Activity ids shown by the earlier build/"another" steps of this run (what the UI would send as `shownActivityIds`). */
  shownIds?: ReadonlySet<string>;
  /** Titles of the same, for the seed oracle. */
  shownTitles?: ReadonlySet<string>;
  /** Signatures (id@start) of the earlier build/"another" steps. */
  priorSignatures?: string[];
  /** The draft the parent had when asking for another variant (the oracle looks around its points). */
  currentItems?: ApiItem[];
};

/** Visit length the engine gives a filler: a cafe 60 min, anything else 90 (FILLER_CONFIG). */
const fillerMinutes = (place: MockPlaceSpec) => (place.primary === "food" ? 60 : 90);

/**
 * Could the place be visited inside the run's day window? Closed that day: no. Open windows (or no hours
 * record / always open): the visit length must fit into the overlap with the window - a place that opens for
 * 30 minutes of an evening window is not a candidate the engine could have used.
 */
export function placeFitsWindow(place: MockPlaceSpec, plan: HoursPlan, run: Pick<RunParams, "date" | "window">): boolean {
  const availability = seededAvailability(plan, run.date);
  if (availability === "closed") return false;
  const winStart = sessionInstant(run.date, run.window.start).getTime();
  const winEnd = sessionInstant(run.date, run.window.end).getTime();
  const need = fillerMinutes(place) * 60_000;
  if (availability === "always" || availability === "unknown") return winEnd - winStart >= need;
  return availability.some((w) => Math.min(w.endMs, winEnd) - Math.max(w.startMs, winStart) >= need);
}

/**
 * Unseen filler places the SEED says could still be shown: age-eligible, not closed that day, not shown
 * yet, and within the mode's reach of the current draft (walking: the same or a neighbouring ~1 km cell;
 * car: the same ~5 km cell). Only seeded places are known to the oracle, so "none" proves nothing about the
 * real catalog - but "some" while the engine says "nothing new" is a premature claim.
 */
export function unseenSeedFillers(run: RunParams, ctx: Pick<CheckContext, "dates" | "shownTitles" | "currentItems">): string[] {
  const near = (ctx.currentItems ?? []).map((i) => specFor(i.card.title)).filter((s): s is SpecInfo => s !== null && s.geoCell5 !== null);
  const found: string[] = [];
  MOCK_PLACES.forEach((place, ordinal) => {
    if (place.lat == null || place.lng == null || ctx.shownTitles?.has(place.title)) return;
    if (run.ageRanges.length > 0 && (place.adultOnly || (place.ages.length > 0 && !place.ages.some((a) => run.ageRanges.includes(a))))) return;
    if (!placeFitsWindow(place, hoursPlanFor(place, ctx.dates, ordinal), run)) return;
    const cells = geoCellsFor(place.lat, place.lng);
    if (!cells) return;
    const reachable = near.some((s) => (run.mode === "walk" ? s.geoCell6 !== null && geoCellWithNeighbors(s.geoCell6).includes(cells.geoCell6) : s.geoCell5 === cells.geoCell5));
    if (reachable) found.push(place.title);
  });
  return found;
}

export function checkResult(
  run: RunParams,
  step: string,
  result: ApiResult,
  ctx: CheckContext,
): Violation[] {
  const out: Violation[] = [];
  const v = (rule: string, detail: string) => out.push({ run: run.id, step, rule, detail });
  const items = [...result.items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const totals = totalsOf(items);

  if (run.mode === "walk") {
    for (const i of items) if (i.travel && i.travel.minutes > 15) v("Пеший переход > 15 мин", `${i.card.title}: ${i.travel.minutes} мин`);
    const limit = run.toddler ? 2000 : 3000;
    const meters = items.reduce((s, i) => s + (i.travel?.distanceM ?? 0), 0);
    if (meters > limit) v("Сумма пешком > лимита", `${meters} м > ${limit} м`);
  } else if (totals.cell5Transitions > 1) {
    v("Больше одного дальнего переезда (geoCell5)", `${totals.cell5Transitions} переходов между ячейками`);
  }

  const windowStart = sessionInstant(run.date, run.window.start).getTime();
  const windowEnd = sessionInstant(run.date, run.window.end).getTime();
  const planStart = sessionInstant(run.date, "12:00").getTime();
  const planEnd = sessionInstant(run.date, "13:30").getTime();

  items.forEach((i, k) => {
    const start = Date.parse(i.startsAt);
    const end = Date.parse(i.endsAt);
    if (start < windowStart || end > windowEnd) v("Точка вне окна дня", `${i.card.title}: ${hm(i.startsAt)}–${hm(i.endsAt)} вне ${run.window.start}–${run.window.end}`);
    if (k > 0 && start < Date.parse(items[k - 1]!.endsAt)) v("Пересечение точек", `${items[k - 1]!.card.title} и ${i.card.title}`);
    if (run.planItem && start < planEnd && end > planStart) v("Пересечение с записью плана (12:00–13:30)", `${i.card.title}: ${hm(i.startsAt)}–${hm(i.endsAt)}`);
    const spec = specFor(i.card.title);
    if (!spec) return;
    if (run.ageRanges.length > 0) {
      if (spec.adultOnly) v("Возраст: место 18+ в детском сценарии", i.card.title);
      else if (spec.ages.length > 0 && !spec.ages.some((a) => run.ageRanges.includes(a))) v("Возраст: нет пересечения диапазонов", `${i.card.title}: ${spec.ages.join(",")} vs ${run.ageRanges.join(",")}`);
    }
    if (spec.placeSpec) {
      const plan = hoursPlanFor(spec.placeSpec, ctx.dates, spec.placeOrdinal);
      const availability = seededAvailability(plan, run.date);
      if (availability === "closed") v("Точка в закрытое время", `${i.card.title}: закрыто/по записи в этот день`);
      else if (Array.isArray(availability) && !availability.some((w) => start >= w.startMs && end <= w.endMs)) v("Точка в закрытое время", `${i.card.title}: ${hm(i.startsAt)}–${hm(i.endsAt)} вне часов работы`);
    }
  });

  const ids = items.map((i) => i.activityId);
  if (new Set(ids).size !== ids.length) v("Повтор точки внутри сценария", ids.join(","));
  const signature = items.map((i) => `${i.activityId}@${i.startsAt}`).join("|");
  if (ctx.stepKind === "another") {
    const kindOf = (i: ApiItem) => i.kind ?? specFor(i.card.title)?.kind ?? "event";
    const repeatedFillers = items.filter((i) => kindOf(i) === "place" && ctx.shownIds?.has(i.activityId));
    if (repeatedFillers.length > 0) v("Повтор заполнителя", `уже показывали: ${repeatedFillers.map((i) => i.card.title).join("; ")}`);
    const sameDay = items.length > 0 && (ctx.priorSignatures ?? []).includes(signature);
    if (sameDay && repeatedFillers.length === 0) v("Повтор якорей без «показали всё»", "тот же набор событий и времён, движок не сказал, что вариантов больше нет");
  }
  if (result.exhausted) {
    const unseen = unseenSeedFillers(run, ctx);
    if (unseen.length > 0) v("Преждевременное «показали всё»", `по сиду ещё есть непоказанные места рядом: ${unseen.slice(0, 4).join("; ")}${unseen.length > 4 ? ` … (${unseen.length})` : ""}`);
  }
  return out;
}

// ------------------------------------------------------------ recurring event (c-weekly) coverage

const WEEKLY_SPEC = MOCK_EVENTS.find((e) => e.key === "c-weekly")!;
export const WEEKLY_TITLE = WEEKLY_SPEC.title;
/** The mock rule: every week at 11:00 from the first Saturday, 90 days; the event lasts the default 90 min. */
const WEEKLY_START = "11:00";
const WEEKLY_END = "12:30";

/**
 * Could the seed's recurring event (no ActivitySession, weekly rule on Saturday 11:00, ages 5-7 / 7-9) be offered
 * in this run? Date on the rule, an age in common, the 11:00-12:30 slot inside the day window and free of the
 * plan fixture (12:00-13:30). The engine does not pick it by a fixed radius (anchors are chosen city-wide, the
 * walking radius is around the anchor), so every other mode is eligible too.
 */
export function weeklyEligible(run: RunParams, dates: Pick<Record<DaySlot, string>, "sat1">): boolean {
  const start = Date.parse(`${dates.sat1}T12:00:00Z`);
  const day = Date.parse(`${run.date}T12:00:00Z`);
  const onRule = dayOfWeek(run.date) === 6 && day >= start && day <= start + 90 * 86_400_000;
  const agesFit = run.ageRanges.some((a) => WEEKLY_SPEC.ages.includes(a));
  const winStart = sessionInstant(run.date, run.window.start).getTime();
  const winEnd = sessionInstant(run.date, run.window.end).getTime();
  const slotStart = sessionInstant(run.date, WEEKLY_START).getTime();
  const slotEnd = sessionInstant(run.date, WEEKLY_END).getTime();
  const overlapsPlan = run.planItem && slotStart < sessionInstant(run.date, "13:30").getTime() && slotEnd > sessionInstant(run.date, "12:00").getTime();
  return onRule && agesFit && slotStart >= winStart && slotEnd <= winEnd && !overlapsPlan;
}

export type WeeklyCoverage = { eligible: string[]; seenIn: string[] };

/** Runs where the recurring event could be offered, and those where any step (build, another, replace) offered it. */
export function weeklyCoverage(runs: readonly { params: RunParams; steps: readonly { result: ApiResult | null }[] }[], dates: Pick<Record<DaySlot, string>, "sat1">): WeeklyCoverage {
  const eligible = runs.filter((r) => weeklyEligible(r.params, dates));
  const seenIn = eligible.filter((r) => r.steps.some((st) => st.result?.items.some((i) => i.card.title === WEEKLY_TITLE)));
  return { eligible: eligible.map((r) => r.params.id), seenIn: seenIn.map((r) => r.params.id) };
}

/** The violation to attach when the event fits somewhere yet never got into any scenario. */
export function weeklyViolation(cov: WeeklyCoverage): Violation | null {
  if (cov.eligible.length === 0 || cov.seenIn.length > 0) return null;
  return { run: cov.eligible[0]!, step: "Все шаги подходящих прогонов", rule: "Повторяющееся событие без сеансов ни разу не попало в сценарий", detail: `подходит по дате, возрасту и окну в ${cov.eligible.length} прогонах (${cov.eligible.join(", ")}), в сценарии не было ни разу` };
}

// ------------------------------------------------------------ report

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Anchors (events with a fixed time) that came back from an earlier variant: normal, only counted. */
export type RepeatInfo = { anchors: string[]; fillers: string[] };
export type StepRecord = { name: string; result: ApiResult | null; httpStatus: number; ms: number; violations: Violation[]; diffNote?: string; alternatives?: string[]; repeats?: RepeatInfo; exhausted?: boolean; unseenLeft?: string[]; anotherNo?: number };

/** Which of this step's points an earlier variant already showed, split into anchors and fillers. */
export function repeatsOf(items: readonly ApiItem[], shownIds: ReadonlySet<string>): RepeatInfo {
  const out: RepeatInfo = { anchors: [], fillers: [] };
  for (const i of items) {
    if (!shownIds.has(i.activityId)) continue;
    ((i.kind ?? specFor(i.card.title)?.kind) === "place" ? out.fillers : out.anchors).push(i.card.title);
  }
  return out;
}
export type RunRecord = { params: RunParams; steps: StepRecord[] };

function timeline(result: ApiResult): string {
  const items = [...result.items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (items.length === 0) return `<p class="muted">нет точек</p>`;
  const rows = items.map((i) => {
    const spec = specFor(i.card.title);
    const notes = [i.hoursUnconfirmed ? "уточните часы работы" : "", i.scheduleUnconfirmed ? "время по расписанию — уточните у организатора" : "", i.approximatePlace ? "примерное место" : "", i.far ? "далеко — заменить?" : "", i.pinned ? "закреплено" : ""].filter(Boolean).join(", ");
    const travel = i.travel ? `${i.travel.minutes} мин · ${(i.travel.distanceM / 1000).toFixed(2)} км · ${i.travel.mode === "walk" ? "пешком" : i.travel.mode === "car" ? "машина" : i.travel.mode}` : "—";
    return `<tr><td>${hm(i.startsAt)}–${hm(i.endsAt)}</td><td>${esc(i.card.title)}</td><td>${esc(spec?.clusterLabel ?? "?")}</td><td>${esc(spec?.geoCell5 ?? "—")}</td><td>${(i.kind ?? spec?.kind) === "place" ? "место" : "событие"}</td><td>${esc(notes)}</td><td>${esc(travel)}</td></tr>`;
  });
  return `<table><thead><tr><th>Время</th><th>Точка</th><th>Кластер</th><th>geoCell5</th><th>Тип</th><th>Пометки</th><th>В пути (от пред.)</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

function stepHtml(step: StepRecord): string {
  const r = step.result;
  const t = r ? totalsOf(r.items) : null;
  const warn = r ? [r.status !== "ok" ? `статус: ${r.status}` : "", r.suggestMode ? `подсказка: переключиться на «${r.suggestMode === "car" ? "машину" : r.suggestMode}»` : "", r.items.some((i) => i.far) ? "есть переезд > 40 мин" : "", r.items.some((i) => i.approximatePlace) ? "есть «примерное место»" : "", r.items.some((i) => i.hoursUnconfirmed) ? "есть места без подтверждённых часов" : "", r.items.some((i) => i.scheduleUnconfirmed) ? "есть события со временем по расписанию (без сеанса)" : ""].filter(Boolean) : [];
  return `<div class="step"><h4>${esc(step.name)} <span class="muted">· HTTP ${step.httpStatus} · ${Math.round(step.ms)} мс${r?.meta ? ` · пул ${r.meta.poolCache}, ${r.meta.poolSize} (мест ${r.meta.poolPlaces ?? 0}), сборка ${r.meta.buildMs} мс` : ""}</span></h4>${r ? timeline(r) : "<p class='bad'>нет ответа</p>"}${t ? `<p>Итого: <b>${t.points}</b> точек · <b>${t.km.toFixed(2)} км</b> · <b>${t.travelMin} мин</b> в пути · переходов между geoCell5: <b>${t.cell5Transitions}</b></p>` : ""}${warn.length ? `<p class="warn">Предупреждения: ${esc(warn.join("; "))}</p>` : ""}${step.diffNote ? `<p class="muted">${esc(step.diffNote)}</p>` : ""}${step.exhausted ? `<p class="warn">Движок ответил «Мы показали всё, что подходит» (нового варианта нет, на экране остаётся прежний).</p>` : ""}${step.repeats && step.repeats.anchors.length ? `<p class="muted">Повтор якорей (норма): ${esc(step.repeats.anchors.join("; "))}</p>` : ""}${step.repeats && step.repeats.fillers.length ? `<p class="bad">Повтор заполнителей: ${esc(step.repeats.fillers.join("; "))}</p>` : ""}${step.alternatives ? `<p>Альтернативы: ${step.alternatives.map((a) => `<span class="chip">${esc(a)}</span>`).join(" ")}</p>` : ""}${step.violations.length ? `<p class="bad">Нарушения: ${step.violations.map((v) => esc(v.rule)).join("; ")}</p>` : ""}</div>`;
}

export function renderReport(input: { generatedAt: string; base: string; build: string; dates: Record<string, string>; runs: RunRecord[]; calls: number; notes: string[]; weekly?: WeeklyCoverage; exhausted?: ExhaustedCoverage }): string {
  const all = input.runs.flatMap((r) => r.steps.flatMap((s) => s.violations));
  const byRule = new Map<string, number>();
  for (const v of all) byRule.set(v.rule, (byRule.get(v.rule) ?? 0) + 1);
  const summaryRows = input.runs.map((r) => {
    const build = r.steps[0]?.result;
    const t = build ? totalsOf(build.items) : null;
    const nv = r.steps.reduce((n, s) => n + s.violations.length, 0);
    const anchorRepeats = r.steps.reduce((n, st) => n + (st.repeats?.anchors.length ?? 0), 0);
    const fillerRepeats = r.steps.reduce((n, st) => n + (st.repeats?.fillers.length ?? 0), 0);
    const allShown = r.steps.filter((st) => st.exhausted).length;
    return `<tr><td><a href="#${esc(r.params.id)}">${esc(r.params.id)}</a></td><td>${esc(r.params.dateLabel)}</td><td>${r.params.mode === "walk" ? "Пешком" : "Машина"}</td><td>${esc(r.params.audience)}</td><td>${esc(build?.status ?? "—")}</td><td>${t ? `${t.points} / ${t.km.toFixed(2)} км / ${t.travelMin} мин / ${t.cell5Transitions}` : "—"}</td><td>${anchorRepeats}</td><td class="${fillerRepeats ? "bad" : "ok"}">${fillerRepeats}</td><td>${allShown}</td><td class="${nv ? "bad" : "ok"}">${nv}</td></tr>`;
  });
  const chainRows = input.runs.map((r) => {
    const anothers = r.steps.filter((st) => st.anotherNo !== undefined);
    const stop = anothers.find((st) => st.exhausted);
    const verdict = !stop ? "«показали всё» не наступило" : (stop.unseenLeft?.length ?? 0) > 0 ? `<span class="bad">преждевременно</span>` : `<span class="ok">обосновано</span>`;
    const left = stop?.unseenLeft ?? [];
    return `<tr><td><a href="#${esc(r.params.id)}">${esc(r.params.id)}</a></td><td>${anothers.filter((st) => !st.exhausted).length}</td><td>${stop ? `шаг ${stop.anotherNo}` : "—"}</td><td class="${left.length ? "bad" : "ok"}">${stop ? left.length : "—"}</td><td>${esc(left.slice(0, 4).join("; "))}${left.length > 4 ? ` … (${left.length})` : ""}</td><td>${verdict}</td></tr>`;
  });
  const violationRows = all.map((v) => `<tr><td><a href="#${esc(v.run)}">${esc(v.run)}</a></td><td>${esc(v.step)}</td><td>${esc(v.rule)}</td><td>${esc(v.detail)}</td></tr>`);
  const sections = input.runs.map((r) => `<section id="${esc(r.params.id)}"><h3>${esc(r.params.id)}</h3><p class="params">Дата: <b>${esc(r.params.dateLabel)}</b> · окно ${esc(r.params.window.start)}–${esc(r.params.window.end)} · режим: <b>${r.params.mode === "walk" ? "Пешком" : "Машина"}</b> · аудитория: <b>${esc(r.params.audience)}</b>${r.params.ageRanges.length ? ` (${esc(r.params.ageRanges.join(", "))})` : ""} · запись плана 12:00: <b>${r.params.planItem ? "да" : "нет"}</b></p>${r.steps.map(stepHtml).join("")}</section>`);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Матрица прогонов: сценарий дня</title><style>
body{font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:24px auto;max-width:1200px;padding:0 16px;color:#1a1410;background:#fff}
h1{font-size:22px}h2{margin-top:32px;border-bottom:1px solid #ddd;padding-bottom:4px}h3{margin:28px 0 4px}h4{margin:14px 0 4px;font-size:14px}
table{border-collapse:collapse;width:100%;margin:6px 0;font-size:13px}th,td{border:1px solid #ddd;padding:4px 8px;text-align:left;vertical-align:top}th{background:#f6f2ec}
.muted{color:#777;font-weight:400}.bad{color:#b3261e;font-weight:600}.ok{color:#1f8a5b;font-weight:600}.warn{color:#8a5a00}.chip{display:inline-block;background:#f6f2ec;border-radius:10px;padding:1px 8px;margin:1px}
.step{border-left:3px solid #eee;padding-left:12px;margin:10px 0}.params{margin:2px 0 8px}code{background:#f6f2ec;padding:1px 4px;border-radius:4px}
@media (prefers-color-scheme:dark){body{background:#161412;color:#eee}th{background:#26221e}th,td{border-color:#3a342e}.chip{background:#26221e}code{background:#26221e}}
</style></head><body>
<h1>Матрица прогонов: сценарий дня (мок-каталог)</h1>
<p class="muted">${esc(input.generatedAt)} · ${esc(input.base)} · сборка ${esc(input.build)} · вызовов к API: ${input.calls} · даты: ${Object.entries(input.dates).map(([k, d]) => `${k}=${d}`).join(", ")}</p>
${input.notes.map((n) => `<p class="muted">${esc(n)}</p>`).join("")}
<h2>Сводка</h2>
<table><thead><tr><th>Прогон</th><th>Дата</th><th>Режим</th><th>Аудитория</th><th>Статус сборки</th><th>Точек / км / мин / переходов geoCell5</th><th>Повторы якорей (норма)</th><th>Повторы заполнителей</th><th>«Показали всё»</th><th>Нарушений</th></tr></thead><tbody>${summaryRows.join("")}</tbody></table>
<h2>Цепочки «Другой вариант»: когда пришло «показали всё»</h2>
<p class="muted">Столбец «Остаток» — сколько ещё непоказанных мест из сида подходят по возрасту и часам работы в тот день и лежат в радиусе режима (пешком: своя и соседняя ячейка ~1 км; машина: ячейка ~5 км) от прежнего черновика. Оракул знает только места мок-каталога, но не весь пул DEV, поэтому «0» подтверждает «обоснованно» только по сиду.</p>
<table><thead><tr><th>Прогон</th><th>Новых вариантов до конца</th><th>«Показали всё» на</th><th>Остаток</th><th>Какие</th><th>Вывод</th></tr></thead><tbody>${chainRows.join("")}</tbody></table>
<h2>Повторяющееся событие без сеансов (c-weekly)</h2>
${input.weekly ? `<p class="muted">Событие из сида: еженедельно по субботам 11:00, возраст 5–7 / 7–9, без ActivitySession (время по расписанию). Должно попасть в сценарий хотя бы в одном из прогонов, где подходят дата, возраст и окно дня. Само по себе оно самое слабое из событий и в обычных прогонах уступает сильным, поэтому есть прогон-доказательство W-…: события-конкуренты из ответов по очереди исключаются (excludeActivityIds), пока оно не выберется.</p><p>Подходящих прогонов: <b>${input.weekly.eligible.length}</b>${input.weekly.eligible.length ? ` (${input.weekly.eligible.map(esc).join(", ")})` : ""}. Попало в сценарий в: <b class="${input.weekly.eligible.length && input.weekly.seenIn.length === 0 ? "bad" : "ok"}">${input.weekly.seenIn.length ? input.weekly.seenIn.map(esc).join(", ") : "—"}</b>.</p>` : `<p class="muted">Проверка не выполнялась.</p>`}
<h2>Нарушения (${all.length})</h2>
${all.length ? `<table><thead><tr><th>Прогон</th><th>Шаг</th><th>Правило</th><th>Детали</th></tr></thead><tbody>${violationRows.join("")}</tbody></table><p>По правилам: ${[...byRule].map(([k, n]) => `${esc(k)} — ${n}`).join("; ")}</p>` : `<p class="ok">Нарушений не найдено.</p>`}
<h2>Прогоны</h2>
${sections.join("\n")}
</body></html>`;
}

export function distanceMeters(a: SpecInfo, b: SpecInfo): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  return Math.round(haversineMeters(a.lat, a.lng, b.lat, b.lng));
}
