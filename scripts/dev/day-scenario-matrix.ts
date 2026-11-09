/**
 * Test matrix for the day-scenario engine on DEV (BACKLOG-230). Read-only against the
 * draft API; the only writes are three "[MOCK]" manual plan notes at 12:00 for the test
 * user (skip with --skip-plan-items). At most --max-calls (default 300) HTTP calls.
 * Repeats are judged like the UI would live them: "another" sends what was already shown;
 * anchors (events) may come back (counted, not a violation), a shown filler place may not.
 *
 *   DEV_TEST_USER_EMAIL=... DEV_TEST_USER_PASSWORD=... \
 *     pnpm tsx scripts/dev/day-scenario-matrix.ts --report=/path/report.html [--apply-date=YYYY-MM-DD]
 *
 * Credentials come from the environment and are never printed or written to the report.
 * Dates are derived from --apply-date (the day `seed:day-scenario-mocks --apply` ran, default today),
 * because the seeded hour exceptions and sessions are relative to that day.
 */
import { writeFileSync } from "node:fs";
import { minskDateOf, resolveSlotDates, sessionInstant } from "../ops/seed-day-scenario-mocks";
import {
  checkResult,
  oracleAgeRanges,
  repeatsOf,
  unseenSeedFillers,
  weeklyCoverage,
  weeklyViolation,
  WEEKLY_TITLE,
  PLAN_FIXTURE_TITLE,
  renderReport,
  TODDLER_RANGES,
  type OracleChild,
  type ApiResult,
  type RunParams,
  type RunRecord,
  type StepKind,
  type StepRecord,
  type Violation,
} from "./day-scenario-matrix.lib";

const args = process.argv.slice(2);
const argValue = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
const BASE = (argValue("base-url") ?? "https://dev.mamago.by").replace(/\/$/, "");
const REPORT = argValue("report");
const MAX_ANOTHER = 6;
const WEEKLY_PROOF_MAX_ROUNDS = 8;
const MAX_CALLS = Number(argValue("max-calls") ?? 300);
const APPLY_DATE = argValue("apply-date") ?? minskDateOf(new Date());
const SKIP_PLAN_ITEMS = args.includes("--skip-plan-items");
const UA = "mamago-matrix/1";
const PACE_MS = 2300; // stays under the 30/min rate limit

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let calls = 0;
function budget(): void {
  if (calls >= MAX_CALLS) throw new Error(`call budget ${MAX_CALLS} exhausted`);
  calls += 1;
}

let cookie = "";

async function post(path: string, body: unknown, authed: boolean): Promise<{ status: number; json: unknown; ms: number }> {
  budget();
  const t0 = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA, ...(authed && cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, ms: performance.now() - t0 };
}

/** Non-draft calls (plan fixtures). Counted against the same call budget. */
async function api(method: "GET" | "DELETE", path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  budget();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", "user-agent": UA, cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = await res.json().catch(() => null);
  await sleep(500);
  return { status: res.status, json };
}

type CalendarItem = { id: string; title: string | null; status: string; updatedAt: string; startsAt: string | null };

async function listPlan(from: string, to: string): Promise<CalendarItem[]> {
  const r = await api("GET", `/api/plan/calendar?from=${from}&to=${to}`);
  if (r.status !== 200) throw new Error(`plan calendar read failed (HTTP ${r.status})`);
  return ((r.json as { items?: CalendarItem[] }).items ?? []).filter((i) => i.status !== "CANCELLED");
}

/** Cancels every runner-owned fixture in the range; returns how many were cancelled. */
async function cancelFixtures(from: string, to: string): Promise<number> {
  let cancelled = 0;
  for (const item of (await listPlan(from, to)).filter((i) => i.title === PLAN_FIXTURE_TITLE)) {
    const r = await api("DELETE", `/api/plan/manual/${item.id}`, { expectedUpdatedAt: item.updatedAt });
    if (r.status === 200) cancelled += 1;
  }
  return cancelled;
}

async function draft(body: object, authed: boolean): Promise<{ step: Omit<StepRecord, "name" | "violations">; result: ApiResult | null }> {
  const r = await post("/api/plan/day-scenario/draft", body, authed);
  await sleep(PACE_MS);
  const result = r.status === 200 ? (r.json as ApiResult) : null;
  return { step: { result, httpStatus: r.status, ms: r.ms }, result };
}

const toCurrent = (res: ApiResult) => res.items.map((i) => ({ activityId: i.activityId, startsAt: i.startsAt }));
const sig = (res: ApiResult) => [...res.items].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((i) => `${i.activityId}@${i.startsAt}`).join("|");

function diffNote(prev: ApiResult | null, cur: ApiResult | null): string {
  if (!prev || !cur) return "";
  const a = new Set(prev.items.map((i) => i.card.title));
  const b = new Set(cur.items.map((i) => i.card.title));
  const added = [...b].filter((t) => !a.has(t));
  const removed = [...a].filter((t) => !b.has(t));
  if (!added.length && !removed.length) return sig(prev) === sig(cur) ? "Без отличий от предыдущего варианта." : "Те же точки, другое время.";
  return `Отличия от предыдущего: добавлено ${added.length ? added.map((t) => `«${t}»`).join(", ") : "—"}; убрано ${removed.length ? removed.map((t) => `«${t}»`).join(", ") : "—"}.`;
}

async function main(): Promise<void> {
  if (!REPORT) throw new Error("--report=<path.html> is required");
  const dates = resolveSlotDates(APPLY_DATE);
  const email = process.env.DEV_TEST_USER_EMAIL;
  const password = process.env.DEV_TEST_USER_PASSWORD;
  if (!email || !password) throw new Error("DEV_TEST_USER_EMAIL / DEV_TEST_USER_PASSWORD are required");

  const health = (await (await fetch(`${BASE}/api/health`)).json().catch(() => ({}))) as { buildId?: string; gitSha?: string };
  const build = `${health.buildId ?? "?"} (${(health.gitSha ?? "").slice(0, 9)})`;

  // login + children (the "7 and 12" audience is both children selected at once)
  const login = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "user-agent": UA }, body: JSON.stringify({ email, password }) });
  budget();
  await login.arrayBuffer();
  cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  if (!login.ok || !cookie) throw new Error(`login failed (${login.status})`);
  budget();
  const kidsRes = await fetch(`${BASE}/api/children`, { headers: { cookie, "user-agent": UA } });
  const kids = ((await kidsRes.json()) as { children?: (OracleChild & { id: string })[] }).children ?? [];
  if (kids.length < 2) throw new Error("the test user needs two children (7 and 12)");
  const personaIds = kids.slice(0, 2).map((k) => k.id);

  const days = [
    { key: "sat", date: dates.sat1, label: `суббота ${dates.sat1}`, window: { start: "09:00", end: "20:00" } },
    { key: "sun", date: dates.sun1, label: `воскресенье ${dates.sun1}`, window: { start: "09:00", end: "20:00" } },
    { key: "wed", date: dates.wed1, label: `будний (среда) ${dates.wed1}`, window: { start: "16:00", end: "20:00" } },
  ];
  // Authenticated audiences: the oracle ages come from the children's birth data per day
  // (personaIds are still what the API receives, so server-side profile resolution is tested).
  const authedAges = Object.fromEntries(days.map((d) => [d.key, oracleAgeRanges(kids.slice(0, 2), d.date)]));
  const rangeFrom = days.map((d) => d.date).sort()[0]!;
  const rangeTo = days.map((d) => d.date).sort().slice(-1)[0]!;
  const audiences = [
    { key: "G03", label: "гость, 0–3 года", ageRanges: ["0-1", "1-3"], toddler: true, authed: false, plan: false },
    { key: "G57", label: "гость, 5–7 лет", ageRanges: ["5-7"], toddler: false, authed: false, plan: false },
    { key: "U712", label: "пользователь, дети 7 и 12 одновременно", ageRanges: [] as string[], toddler: false, authed: true, plan: false },
    { key: "U712P", label: "пользователь 7 и 12 + запись плана 12:00", ageRanges: [] as string[], toddler: false, authed: true, plan: true },
  ];

  const runs: RunRecord[] = [];
  const notes: string[] = [
    `Запись плана 12:00–13:30 создаётся через POST /api/plan/manual («${PLAN_FIXTURE_TITLE}») только для аудитории «+ запись плана»; у остальных её нет. После прогона такие записи отменяются (статус CANCELLED).`,
    `Нарушения оцениваются по эталону из сида (координаты, часы работы, возраст мок-точек), а не по ответам движка. Возраст аудитории «пользователь» считается из дат рождения детей на каждую дату.`,
  ];

  // Baseline: remove fixtures left by an earlier execution, then make sure the plan-free audiences
  // really run without plan entries.
  const leftovers = await cancelFixtures(rangeFrom, rangeTo);
  if (leftovers > 0) notes.push(`Перед прогоном отменено записей-остатков от прошлых запусков: ${leftovers}.`);
  const remaining = await listPlan(rangeFrom, rangeTo);
  if (remaining.some((i) => i.title === PLAN_FIXTURE_TITLE)) throw new Error("fixtures from a previous execution could not be cancelled; aborting before collecting results");
  const foreign = remaining.filter((i) => i.startsAt);
  if (foreign.length > 0) notes.push(`ВНИМАНИЕ: в плане пользователя на даты прогона уже есть записей со временем: ${foreign.length}. Они влияют на ВСЕ аудитории, включая «без записи плана».`);

  let tornDown = false;
  const teardown = async () => {
    if (tornDown) return;
    tornDown = true;
    try {
      const n = await cancelFixtures(rangeFrom, rangeTo);
      notes.push(`После прогона отменено созданных записей плана: ${n}.`);
    } catch (error) {
      notes.push(`ВНИМАНИЕ: не удалось отменить записи плана «${PLAN_FIXTURE_TITLE}»: ${error instanceof Error ? error.message : String(error)}.`);
    }
  };

  // One run: build, a chain of «Другой вариант», «Заменить». `window` and `maxAnother` differ for the narrow runs.
  const runOne = async (aud: (typeof audiences)[number], d: (typeof days)[number], mode: "walk" | "car", window: { start: string; end: string }, id: string, maxAnother: number): Promise<void> => {
    const ages = aud.authed ? authedAges[d.key]! : aud.ageRanges;
    const params: RunParams = {
      id,
      date: d.date,
      dateLabel: d.label,
      mode,
      audience: aud.label,
      ageRanges: ages,
      toddler: aud.authed ? ages.some((a) => TODDLER_RANGES.has(a)) : aud.toddler,
      window,
      planItem: aud.plan,
    };
    const common = { city: "minsk", date: d.date, mode, targetCount: 3, dayStart: window.start, dayEnd: window.end, ...(aud.authed ? { personaIds } : { ageRanges: aud.ageRanges }) };
    const steps: StepRecord[] = [];
    // What the UI knows about this day: every point shown so far (it sends them as `shownActivityIds`).
    const shownIds = new Set<string>();
    const shownTitles = new Set<string>();
    const signatures: string[] = [];
    const remember = (res: ApiResult) => {
      for (const i of res.items) {
        shownIds.add(i.activityId);
        shownTitles.add(i.card.title);
      }
      signatures.push(sig(res));
    };
    const add = (name: string, base: Omit<StepRecord, "name" | "violations">, kind: StepKind, extra: Partial<StepRecord> = {}, currentItems?: ApiResult["items"]) => {
      const violations: Violation[] = base.result
        ? checkResult(params, name, base.result, { dates, stepKind: kind, shownIds: new Set(shownIds), shownTitles: new Set(shownTitles), priorSignatures: [...signatures], currentItems })
        : [{ run: params.id, step: name, rule: "Ответ API", detail: `HTTP ${base.httpStatus}` }];
      const repeats = kind === "another" && base.result ? repeatsOf(base.result.items, shownIds) : undefined;
      const exhausted = base.result?.exhausted === true;
      const unseenLeft = exhausted ? unseenSeedFillers(params, { dates, shownTitles, currentItems }) : undefined;
      steps.push({ name, ...base, violations, repeats, exhausted, unseenLeft, ...extra });
    };

    const built = await draft({ ...common, action: "build", variant: 0 }, aud.authed);
    add("Собрать", built.step, "build");
    if (built.result) remember(built.result);
    let current = built.result;
    // a chain of "Другой вариант" until the engine says everything was shown (at most MAX_ANOTHER steps)
    let nextVariant = 1;
    for (let v = 1; v <= maxAnother; v++) {
      const next = await draft({ ...common, action: "another", variant: nextVariant, current: current ? toCurrent(current) : [], shownActivityIds: [...shownIds] }, aud.authed);
      const shownNote = next.result?.exhausted ? "Нового варианта нет: на экране остаётся прежний." : diffNote(current, next.result);
      add(`Другой вариант ${v}`, next.step, "another", { diffNote: shownNote, anotherNo: v }, current?.items);
      if (next.result?.exhausted) break;
      if (next.result && !next.result.exhausted) {
        remember(next.result);
        current = next.result;
        nextVariant = (next.result.variant ?? nextVariant) + 1;
      }
    }
    // "Заменить": one request returns up to three whole-day variants for one point
    const base = built.result;
    if (base && base.items.length > 0) {
      const sorted = [...base.items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      const victim = sorted[Math.min(1, sorted.length - 1)]!;
      const rep = await draft({ ...common, action: "alternatives", variant: 0, current: toCurrent(base), replaceActivityId: victim.activityId }, aud.authed);
      const kept = new Set(sorted.filter((i) => i.activityId !== victim.activityId).map((i) => i.activityId));
      const variants = rep.result?.alternatives ?? [];
      const freshTitles = variants.map((items) => items.find((i) => !kept.has(i.activityId))?.card.title ?? "—");
      if (variants.length === 0) {
        add(`Заменить «${victim.card.title}»`, rep.step, "other", { alternatives: ["— замены не нашлось —"] });
        notes.push(`${params.id}: для «Заменить» альтернатив не найдено.`);
      }
      variants.forEach((items, k) => {
        const asResult: ApiResult = { status: "ok", mode: common.mode, suggestMode: null, items };
        add(`Заменить «${victim.card.title}» (вариант ${k + 1})`, { result: asResult, httpStatus: rep.step.httpStatus, ms: rep.step.ms }, "alternative", {
          alternatives: k === 0 ? freshTitles : undefined,
          diffNote: diffNote(base, asResult),
        });
      });
      if (new Set(freshTitles).size !== freshTitles.length) notes.push(`${params.id}: «Заменить» предложил одну альтернативу дважды.`);
    }
    runs.push({ params, steps });
    console.log(`${params.id}: ${built.result?.status ?? "HTTP " + built.step.httpStatus}, calls=${calls}`);
  };

  try {
  for (const aud of audiences) {
    if (aud.plan && !SKIP_PLAN_ITEMS) {
      for (const d of days) {
        const created = await post("/api/plan/manual", { title: PLAN_FIXTURE_TITLE, date: d.date, startsAt: sessionInstant(d.date, "12:00").toISOString(), endsAt: sessionInstant(d.date, "13:30").toISOString() }, true);
        await sleep(500);
        if (created.status !== 201) notes.push(`Запись плана на ${d.date}: HTTP ${created.status} — прогоны с записью могут быть невалидны.`);
      }
    }
    for (const d of days) {
      for (const mode of ["walk", "car"] as const) {
        await runOne(aud, d, mode, d.window, `${aud.key}-${d.key}-${mode}`, MAX_ANOTHER);
      }
    }
  }
  // c-weekly proof: the recurring mock event is the weakest event, so ordinary runs rarely pick it. Take a run it fits
  // (guest 5-7, Saturday, by car), then exclude the competing events of each answer until it is the one chosen. That shows
  // its virtual session can reach a scenario (excludeActivityIds is capped at 100 ids by the API).
  {
    const d = days.find((x) => x.key === "sat")!;
    const params: RunParams = { id: "W-sat-car-57", date: d.date, dateLabel: d.label, mode: "car", audience: "гость, 5–7 лет (прогон-доказательство c-weekly)", ageRanges: ["5-7"], toddler: false, window: d.window, planItem: false };
    const steps: StepRecord[] = [];
    const excluded = new Set<string>();
    for (let round = 1; round <= WEEKLY_PROOF_MAX_ROUNDS; round++) {
      const built = await draft({ city: "minsk", date: d.date, mode: "car", targetCount: 3, dayStart: d.window.start, dayEnd: d.window.end, ageRanges: params.ageRanges, action: "build", variant: 0, excludeActivityIds: [...excluded] }, false);
      const name = `Собрать без ${excluded.size} событий-конкурентов`;
      const violations: Violation[] = built.result ? checkResult(params, name, built.result, { dates, stepKind: "build" }) : [{ run: params.id, step: name, rule: "Ответ API", detail: `HTTP ${built.step.httpStatus}` }];
      steps.push({ name, ...built.step, violations });
      if (!built.result) break;
      if (built.result.items.some((i) => i.card.title === WEEKLY_TITLE)) break;
      const rivals = built.result.items.filter((i) => (i.kind ?? "event") === "event" && i.card.title !== WEEKLY_TITLE).map((i) => i.activityId);
      if (rivals.length === 0 || rivals.every((id) => excluded.has(id)) || excluded.size + rivals.length > 100) break;
      for (const id of rivals) excluded.add(id);
    }
    runs.push({ params, steps });
    console.log(`${params.id}: ${steps.length} rounds, excluded ${excluded.size}, calls=${calls}`);
  }
  } finally {
    await teardown();
  }

  // The recurring mock event (no sessions) must reach a scenario somewhere it fits: otherwise its virtual session is shadowed.
  const weekly = weeklyCoverage(runs, dates);
  const weeklyProblem = weeklyViolation(weekly);
  if (weeklyProblem) runs.find((r) => r.params.id === weeklyProblem.run)?.steps[0]?.violations.push(weeklyProblem);
  const html = renderReport({ generatedAt: new Date().toISOString(), base: BASE, build, dates: dates as Record<string, string>, runs, calls, notes, weekly });
  writeFileSync(REPORT, html, "utf8");
  const violations = runs.flatMap((r) => r.steps.flatMap((s) => s.violations));
  console.log(JSON.stringify({ report: REPORT, runs: runs.length, calls, violations: violations.length, weeklyEligibleRuns: weekly.eligible.length, weeklySeenIn: weekly.seenIn }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
