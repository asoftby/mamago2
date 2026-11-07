/**
 * Test matrix for the day-scenario engine on DEV (BACKLOG-230). Read-only against the
 * draft API; the only writes are three "[MOCK]" manual plan notes at 12:00 for the test
 * user (skip with --skip-plan-items). At most --max-calls (default 300) HTTP calls.
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
  renderReport,
  type ApiResult,
  type RunParams,
  type RunRecord,
  type StepRecord,
  type Violation,
} from "./day-scenario-matrix.lib";

const args = process.argv.slice(2);
const argValue = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
const BASE = (argValue("base-url") ?? "https://dev.mamago.by").replace(/\/$/, "");
const REPORT = argValue("report");
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
  const kids = ((await kidsRes.json()) as { children?: { id: string }[] }).children ?? [];
  if (kids.length < 2) throw new Error("the test user needs two children (7 and 12)");
  const personaIds = kids.slice(0, 2).map((k) => k.id);

  const days = [
    { key: "sat", date: dates.sat1, label: `суббота ${dates.sat1}`, window: { start: "09:00", end: "20:00" } },
    { key: "sun", date: dates.sun1, label: `воскресенье ${dates.sun1}`, window: { start: "09:00", end: "20:00" } },
    { key: "wed", date: dates.wed1, label: `будний (среда) ${dates.wed1}`, window: { start: "16:00", end: "20:00" } },
  ];
  const audiences = [
    { key: "G03", label: "гость, 0–3 года", ageRanges: ["0-1", "1-3"], toddler: true, authed: false, plan: false },
    { key: "G57", label: "гость, 5–7 лет", ageRanges: ["5-7"], toddler: false, authed: false, plan: false },
    { key: "U712", label: "пользователь, дети 7 и 12 одновременно", ageRanges: [] as string[], toddler: false, authed: true, plan: false },
    { key: "U712P", label: "пользователь 7 и 12 + запись плана 12:00", ageRanges: [] as string[], toddler: false, authed: true, plan: true },
  ];

  const runs: RunRecord[] = [];
  const notes: string[] = [
    `Запись плана 12:00–13:30 создаётся через POST /api/plan/manual («[MOCK] Запись плана 12:00»); у аудитории «+ запись плана» она уже есть, у остальных — нет.`,
    `Нарушения оцениваются по эталону из сида (координаты, часы работы, возраст мок-точек), а не по ответам движка.`,
  ];

  for (const aud of audiences) {
    if (aud.plan && !SKIP_PLAN_ITEMS) {
      for (const d of days) {
        const created = await post("/api/plan/manual", { title: "[MOCK] Запись плана 12:00", date: d.date, startsAt: sessionInstant(d.date, "12:00").toISOString(), endsAt: sessionInstant(d.date, "13:30").toISOString() }, true);
        await sleep(500);
        if (created.status !== 201) notes.push(`Запись плана на ${d.date}: HTTP ${created.status} — прогоны с записью могут быть невалидны.`);
      }
    }
    for (const d of days) {
      for (const mode of ["walk", "car"] as const) {
        const params: RunParams = {
          id: `${aud.key}-${d.key}-${mode}`,
          date: d.date,
          dateLabel: d.label,
          mode,
          audience: aud.label,
          ageRanges: aud.ageRanges,
          toddler: aud.toddler,
          window: d.window,
          planItem: aud.plan,
        };
        const common = { city: "minsk", date: d.date, mode, targetCount: 3, dayStart: d.window.start, dayEnd: d.window.end, ...(aud.authed ? { personaIds } : { ageRanges: aud.ageRanges }) };
        const steps: StepRecord[] = [];
        const signatures: string[] = [];
        const add = (name: string, base: Omit<StepRecord, "name" | "violations">, extra: Partial<StepRecord> = {}) => {
          const violations: Violation[] = base.result ? checkResult(params, name, base.result, { dates, priorSignatures: signatures }) : [{ run: params.id, step: name, rule: "Ответ API", detail: `HTTP ${base.httpStatus}` }];
          if (base.result) signatures.push(sig(base.result));
          steps.push({ name, ...base, violations, ...extra });
        };

        const built = await draft({ ...common, action: "build", variant: 0 }, aud.authed);
        add("Собрать", built.step);
        let current = built.result;
        for (let v = 1; v <= 3; v++) {
          const next = await draft({ ...common, action: "rebuild", variant: v, current: current ? toCurrent(current) : [], pinnedActivityIds: [] }, aud.authed);
          add(`Другой вариант ${v}`, next.step, { diffNote: diffNote(current, next.result) });
          current = next.result ?? current;
        }
        // "Заменить": one point, three alternatives against the original build
        const base = built.result;
        if (base && base.items.length > 0) {
          const sorted = [...base.items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
          const victim = sorted[Math.min(1, sorted.length - 1)]!;
          const alternatives = new Set<string>();
          for (let v = 1; v <= 3; v++) {
            const rep = await draft({ ...common, action: "replace", variant: v, current: toCurrent(base), replaceActivityId: victim.activityId }, aud.authed);
            const kept = new Set(sorted.filter((i) => i.activityId !== victim.activityId).map((i) => i.activityId));
            const fresh = (rep.result?.items ?? []).filter((i) => !kept.has(i.activityId)).map((i) => i.card.title);
            fresh.forEach((t) => alternatives.add(t));
            add(`Заменить «${victim.card.title}» (попытка ${v})`, rep.step, { alternatives: fresh.length ? fresh : ["— замены не нашлось —"], diffNote: diffNote(base, rep.result) });
          }
          if (alternatives.size === 0) notes.push(`${params.id}: для «Заменить» альтернатив не найдено.`);
        }
        runs.push({ params, steps });
        console.log(`${params.id}: ${built.result?.status ?? "HTTP " + built.step.httpStatus}, calls=${calls}`);
      }
    }
  }

  const html = renderReport({ generatedAt: new Date().toISOString(), base: BASE, build, dates: dates as Record<string, string>, runs, calls, notes });
  writeFileSync(REPORT, html, "utf8");
  const violations = runs.flatMap((r) => r.steps.flatMap((s) => s.violations));
  console.log(JSON.stringify({ report: REPORT, runs: runs.length, calls, violations: violations.length }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
