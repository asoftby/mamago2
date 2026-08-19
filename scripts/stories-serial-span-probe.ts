#!/usr/bin/env tsx
/**
 * Phase 2.5 — measure Activity session span before choosing serial threshold.
 *
 * Usage:
 *   set -a; source .env; set +a
 *   pnpm exec tsx scripts/stories-serial-span-probe.ts [--city=minsk]
 */

import { ActivityType } from "@prisma/client";
import prisma from "../src/lib/prisma";
import { findCityBySlug } from "../src/server/geo/findCityBySlug";
import { getPublicListingActivityWhere } from "../src/server/public/publicContentVisibility";
import { activityInCityWhere } from "../src/server/discovery/activityInCityWhere";

type Row = {
  id: string;
  title: string;
  sessionCount: number;
  spanDays: number;
  minAt: Date;
  maxAt: Date;
};

function parseArgs(argv: string[]) {
  let citySlug = "minsk";
  for (const arg of argv) {
    if (arg.startsWith("--city=")) citySlug = arg.slice("--city=".length);
  }
  return { citySlug };
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

function bucketSpan(spanDays: number): string {
  if (spanDays <= 0) return "0";
  if (spanDays < 1) return "<1";
  if (spanDays < 2) return "1";
  if (spanDays < 3) return "2";
  if (spanDays < 5) return "3–4";
  if (spanDays < 8) return "5–7";
  if (spanDays < 15) return "8–14";
  if (spanDays < 22) return "15–21";
  if (spanDays < 32) return "22–31";
  if (spanDays < 62) return "32–61";
  return "62+";
}

function bucketSessions(n: number): string {
  if (n <= 1) return "1";
  if (n === 2) return "2";
  if (n <= 4) return "3–4";
  if (n <= 7) return "5–7";
  if (n <= 14) return "8–14";
  if (n <= 24) return "15–24";
  if (n <= 40) return "25–40";
  return "41+";
}

async function main() {
  const { citySlug } = parseArgs(process.argv.slice(2));
  const city = await findCityBySlug(citySlug);
  if (!city) {
    console.error(`City not found: ${citySlug}`);
    process.exit(1);
  }

  const now = new Date();
  const pub = getPublicListingActivityWhere(now);
  const pubParts = Array.isArray(pub.AND) ? pub.AND : pub.AND ? [pub.AND] : [];

  const activities = await prisma.activity.findMany({
    where: {
      AND: [
        { type: ActivityType.EVENT },
        activityInCityWhere(city.id),
        ...pubParts,
        { sessions: { some: {} } },
      ],
    },
    select: {
      id: true,
      title: true,
      sessions: {
        select: { startsAt: true },
        orderBy: { startsAt: "asc" },
      },
    },
  });

  const rows: Row[] = [];
  for (const a of activities) {
    if (a.sessions.length === 0) continue;
    const times = a.sessions.map((s) => s.startsAt.getTime());
    const minAt = new Date(Math.min(...times));
    const maxAt = new Date(Math.max(...times));
    const spanDays = (maxAt.getTime() - minAt.getTime()) / 86_400_000;
    rows.push({
      id: a.id,
      title: a.title,
      sessionCount: a.sessions.length,
      spanDays,
      minAt,
      maxAt,
    });
  }

  rows.sort((a, b) => a.spanDays - b.spanDays || a.sessionCount - b.sessionCount);

  const spans = rows.map((r) => r.spanDays);
  const counts = rows.map((r) => r.sessionCount).sort((a, b) => a - b);
  const spansSorted = [...spans].sort((a, b) => a - b);

  console.log(`# Serial span probe`);
  console.log(`city=${city.slug} published EVENT activities with ≥1 session: ${rows.length}`);
  console.log(`as_of=${now.toISOString()}`);
  console.log(``);

  console.log(`## span_days percentiles`);
  for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1]) {
    const v = percentile(spansSorted, p);
    console.log(`p${Math.round(p * 100)}: ${v == null ? "—" : v.toFixed(2)}`);
  }
  console.log(``);

  console.log(`## session_count percentiles`);
  for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1]) {
    const v = percentile(counts, p);
    console.log(`p${Math.round(p * 100)}: ${v == null ? "—" : v.toFixed(2)}`);
  }
  console.log(``);

  const spanHist = new Map<string, number>();
  const sessHist = new Map<string, number>();
  const joint = new Map<string, number>();
  for (const r of rows) {
    const sb = bucketSpan(r.spanDays);
    const cb = bucketSessions(r.sessionCount);
    spanHist.set(sb, (spanHist.get(sb) ?? 0) + 1);
    sessHist.set(cb, (sessHist.get(cb) ?? 0) + 1);
    const key = `${sb} × ${cb}`;
    joint.set(key, (joint.get(key) ?? 0) + 1);
  }

  const spanOrder = [
    "0",
    "<1",
    "1",
    "2",
    "3–4",
    "5–7",
    "8–14",
    "15–21",
    "22–31",
    "32–61",
    "62+",
  ];
  const sessOrder = ["1", "2", "3–4", "5–7", "8–14", "15–24", "25–40", "41+"];

  console.log(`## Histogram: span_days`);
  console.log(`bucket | n | share`);
  for (const b of spanOrder) {
    const n = spanHist.get(b) ?? 0;
    if (n === 0 && !["0", "<1", "1", "2"].includes(b)) continue;
    console.log(`${b} | ${n} | ${((n / Math.max(rows.length, 1)) * 100).toFixed(1)}%`);
  }
  console.log(``);

  console.log(`## Histogram: session_count`);
  console.log(`bucket | n | share`);
  for (const b of sessOrder) {
    const n = sessHist.get(b) ?? 0;
    console.log(`${b} | ${n} | ${((n / Math.max(rows.length, 1)) * 100).toFixed(1)}%`);
  }
  console.log(``);

  console.log(`## Joint (span_days × session_count), non-empty`);
  console.log(`cell | n`);
  const jointSorted = [...joint.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, n] of jointSorted) {
    console.log(`${k} | ${n}`);
  }
  console.log(``);

  // Gap scan on rounded span_days (integer days)
  const byIntSpan = new Map<number, number>();
  for (const r of rows) {
    const d = Math.round(r.spanDays);
    byIntSpan.set(d, (byIntSpan.get(d) ?? 0) + 1);
  }
  const intSpans = [...byIntSpan.keys()].sort((a, b) => a - b);
  console.log(`## Density by rounded span_days (looking for gap)`);
  console.log(`span | n`);
  for (const d of intSpans) {
    console.log(`${d} | ${byIntSpan.get(d)}`);
  }
  console.log(``);

  // Cumulative from long side — how many would be serial at threshold T (span_days >= T)
  console.log(`## If serial := span_days >= T  (and optionally session_count >= S)`);
  console.log(`T_days | serial_n | serial% | point_n | point%`);
  for (const T of [1, 2, 3, 4, 5, 7, 8, 10, 14, 15, 21, 28]) {
    const serial = rows.filter((r) => r.spanDays >= T).length;
    const point = rows.length - serial;
    console.log(
      `${T} | ${serial} | ${((serial / Math.max(rows.length, 1)) * 100).toFixed(1)}% | ${point} | ${((point / Math.max(rows.length, 1)) * 100).toFixed(1)}%`,
    );
  }
  console.log(``);

  console.log(`## If serial := span_days >= T AND session_count >= S`);
  console.log(`T,S | serial_n | serial% | point_n`);
  for (const T of [3, 5, 7, 14]) {
    for (const S of [2, 3, 5, 8]) {
      const serial = rows.filter((r) => r.spanDays >= T && r.sessionCount >= S).length;
      const point = rows.length - serial;
      console.log(
        `${T},${S} | ${serial} | ${((serial / Math.max(rows.length, 1)) * 100).toFixed(1)}% | ${point}`,
      );
    }
  }
  console.log(``);

  // Show extremes
  console.log(`## Shortest 10 (likely point)`);
  for (const r of rows.slice(0, 10)) {
    console.log(
      JSON.stringify({
        title: r.title.slice(0, 55),
        spanDays: Number(r.spanDays.toFixed(2)),
        sessionCount: r.sessionCount,
        from: r.minAt.toISOString().slice(0, 10),
        to: r.maxAt.toISOString().slice(0, 10),
      }),
    );
  }
  console.log(``);
  console.log(`## Longest 10 (likely serial)`);
  for (const r of rows.slice(-10).reverse()) {
    console.log(
      JSON.stringify({
        title: r.title.slice(0, 55),
        spanDays: Number(r.spanDays.toFixed(2)),
        sessionCount: r.sessionCount,
        from: r.minAt.toISOString().slice(0, 10),
        to: r.maxAt.toISOString().slice(0, 10),
      }),
    );
  }

  // Propose gap: find largest empty/low density stretch between populated bins
  let bestGap: { from: number; to: number; empty: number } | null = null;
  for (let i = 0; i < intSpans.length - 1; i++) {
    const a = intSpans[i]!;
    const b = intSpans[i + 1]!;
    const empty = b - a - 1;
    if (empty <= 0) continue;
    if (!bestGap || empty > bestGap.empty) {
      bestGap = { from: a, to: b, empty };
    }
  }
  console.log(``);
  console.log(`## Largest gap between occupied rounded span_days`);
  if (bestGap) {
    console.log(
      `between ${bestGap.from}d and ${bestGap.to}d (empty ${bestGap.empty} day values)`,
    );
  } else {
    console.log(`no gap (continuous occupancy)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
