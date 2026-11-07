/**
 * Pure analysis + HTML rendering for the day-scenario test matrix (BACKLOG-230).
 * No I/O: the runner feeds it API responses, the oracle comes from the mock seed specs,
 * so violations are judged against what the seed *says* (independent of the engine).
 */
import { geoCellsFor } from "../../src/lib/geo/geoCell";
import { haversineMeters } from "../../src/lib/geo/haversineMeters";
import { CLUSTER_LABEL, MOCK_PLACES, type MockPlaceSpec } from "../ops/day-scenario-mocks/places.data";
import { MOCK_EVENTS } from "../ops/day-scenario-mocks/events.data";
import { hoursPlanFor, sessionInstant, type HoursPlan } from "../ops/seed-day-scenario-mocks";
import type { DaySlot } from "../ops/day-scenario-mocks/events.data";

export type ApiItem = {
  kind?: "event" | "place";
  hoursUnconfirmed?: boolean;
  activityId: string;
  card: { title: string; categoryName?: string | null; address?: string | null };
  startsAt: string;
  endsAt: string;
  pinned?: boolean;
  travel: { mode: string; minutes: number; distanceM: number } | null;
  approximatePlace: boolean;
  far: boolean;
};
export type ApiResult = { status: string; mode: string; suggestMode: string | null; items: ApiItem[]; meta?: { poolCache?: string; poolSize?: number; poolPlaces?: number; candidateCount?: number; buildMs?: number } };

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

export function checkResult(
  run: RunParams,
  step: string,
  result: ApiResult,
  ctx: { dates: Record<DaySlot, string>; priorSignatures: string[] },
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
  if (ctx.priorSignatures.includes(signature) && items.length > 0) v("Повтор варианта", "набор точек и времён совпал с одним из предыдущих");
  return out;
}

// ------------------------------------------------------------ report

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type StepRecord = { name: string; result: ApiResult | null; httpStatus: number; ms: number; violations: Violation[]; diffNote?: string; alternatives?: string[] };
export type RunRecord = { params: RunParams; steps: StepRecord[] };

function timeline(result: ApiResult): string {
  const items = [...result.items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (items.length === 0) return `<p class="muted">нет точек</p>`;
  const rows = items.map((i) => {
    const spec = specFor(i.card.title);
    const notes = [i.hoursUnconfirmed ? "уточните часы работы" : "", i.approximatePlace ? "примерное место" : "", i.far ? "далеко — заменить?" : "", i.pinned ? "закреплено" : ""].filter(Boolean).join(", ");
    const travel = i.travel ? `${i.travel.minutes} мин · ${(i.travel.distanceM / 1000).toFixed(2)} км · ${i.travel.mode === "walk" ? "пешком" : i.travel.mode === "car" ? "машина" : i.travel.mode}` : "—";
    return `<tr><td>${hm(i.startsAt)}–${hm(i.endsAt)}</td><td>${esc(i.card.title)}</td><td>${esc(spec?.clusterLabel ?? "?")}</td><td>${esc(spec?.geoCell5 ?? "—")}</td><td>${(i.kind ?? spec?.kind) === "place" ? "место" : "событие"}</td><td>${esc(notes)}</td><td>${esc(travel)}</td></tr>`;
  });
  return `<table><thead><tr><th>Время</th><th>Точка</th><th>Кластер</th><th>geoCell5</th><th>Тип</th><th>Пометки</th><th>В пути (от пред.)</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

function stepHtml(step: StepRecord): string {
  const r = step.result;
  const t = r ? totalsOf(r.items) : null;
  const warn = r ? [r.status !== "ok" ? `статус: ${r.status}` : "", r.suggestMode ? `подсказка: переключиться на «${r.suggestMode === "car" ? "машину" : r.suggestMode}»` : "", r.items.some((i) => i.far) ? "есть переезд > 40 мин" : "", r.items.some((i) => i.approximatePlace) ? "есть «примерное место»" : "", r.items.some((i) => i.hoursUnconfirmed) ? "есть места без подтверждённых часов" : ""].filter(Boolean) : [];
  return `<div class="step"><h4>${esc(step.name)} <span class="muted">· HTTP ${step.httpStatus} · ${Math.round(step.ms)} мс${r?.meta ? ` · пул ${r.meta.poolCache}, ${r.meta.poolSize} (мест ${r.meta.poolPlaces ?? 0}), сборка ${r.meta.buildMs} мс` : ""}</span></h4>${r ? timeline(r) : "<p class='bad'>нет ответа</p>"}${t ? `<p>Итого: <b>${t.points}</b> точек · <b>${t.km.toFixed(2)} км</b> · <b>${t.travelMin} мин</b> в пути · переходов между geoCell5: <b>${t.cell5Transitions}</b></p>` : ""}${warn.length ? `<p class="warn">Предупреждения: ${esc(warn.join("; "))}</p>` : ""}${step.diffNote ? `<p class="muted">${esc(step.diffNote)}</p>` : ""}${step.alternatives ? `<p>Альтернативы: ${step.alternatives.map((a) => `<span class="chip">${esc(a)}</span>`).join(" ")}</p>` : ""}${step.violations.length ? `<p class="bad">Нарушения: ${step.violations.map((v) => esc(v.rule)).join("; ")}</p>` : ""}</div>`;
}

export function renderReport(input: { generatedAt: string; base: string; build: string; dates: Record<string, string>; runs: RunRecord[]; calls: number; notes: string[] }): string {
  const all = input.runs.flatMap((r) => r.steps.flatMap((s) => s.violations));
  const byRule = new Map<string, number>();
  for (const v of all) byRule.set(v.rule, (byRule.get(v.rule) ?? 0) + 1);
  const summaryRows = input.runs.map((r) => {
    const build = r.steps[0]?.result;
    const t = build ? totalsOf(build.items) : null;
    const nv = r.steps.reduce((n, s) => n + s.violations.length, 0);
    return `<tr><td><a href="#${esc(r.params.id)}">${esc(r.params.id)}</a></td><td>${esc(r.params.dateLabel)}</td><td>${r.params.mode === "walk" ? "Пешком" : "Машина"}</td><td>${esc(r.params.audience)}</td><td>${esc(build?.status ?? "—")}</td><td>${t ? `${t.points} / ${t.km.toFixed(2)} км / ${t.travelMin} мин / ${t.cell5Transitions}` : "—"}</td><td class="${nv ? "bad" : "ok"}">${nv}</td></tr>`;
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
<table><thead><tr><th>Прогон</th><th>Дата</th><th>Режим</th><th>Аудитория</th><th>Статус сборки</th><th>Точек / км / мин / переходов geoCell5</th><th>Нарушений</th></tr></thead><tbody>${summaryRows.join("")}</tbody></table>
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
