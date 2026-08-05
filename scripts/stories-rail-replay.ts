#!/usr/bin/env tsx
/**
 * Stories rail 30-day replay — branch (a) geometry: today + running.
 *
 * Uses CURRENT published content projected onto each of the last 30 civil days
 * in the city TZ. This is an estimate, not historical truth.
 *
 * Usage:
 *   set -a; source .env; set +a
 *   pnpm exec tsx scripts/stories-rail-replay.ts [--city=minsk] [--days=30]
 */

import { addDateKeyDays, weekdayFromDateKey, zonedDateKey } from "../src/lib/stories/ranges";
import { getCityTimeZone } from "../src/lib/stories/getCityTimeZone";
import { STORY_SLOTS, DEFERRED_STORY_SLOT_IDS } from "../src/lib/stories/registry";
import { resolveSlots } from "../src/lib/stories/resolveSlots";
import { applyRenderPolicy, DEFAULT_RENDER_POLICY } from "../src/lib/stories/renderPolicy";
import {
  DEFAULT_SLOT_MIN_ITEMS,
  TODAY_SLOT_MIN_ITEMS,
} from "../src/lib/stories/types";
import type { OngoingTemporalPolicy } from "../src/lib/stories/ongoingPolicy";
import { SERIAL_CLASSIFICATION_CONFIG } from "../src/lib/stories/serialConfig";
import {
  jaccardByItemIds,
  jaccardByParentEntity,
  visualDuplicatePairRate,
} from "../src/lib/stories/metrics";
import { findCityBySlug } from "../src/server/geo/findCityBySlug";
import { buildStoryRailData } from "../src/server/stories/resolveStoryRail";
import { fromZonedTime } from "date-fns-tz";

const POLICIES: OngoingTemporalPolicy[] = ["always", "never", "boundary"];
const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
/** Cross-slot entity overlap sanity (point vs serial should stay near 0). */
const NEIGHBOR_PAIRS: Array<[string, string]> = [["today", "running"]];

function parseArgs(argv: string[]) {
  let citySlug = "minsk";
  let days = 30;
  for (const arg of argv) {
    if (arg.startsWith("--city=")) citySlug = arg.slice("--city=".length);
    if (arg.startsWith("--days=")) days = Number(arg.slice("--days=".length)) || 30;
  }
  return { citySlug, days };
}

function pct(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(0)}%`;
}

function fmtIds(ids: string[]): string {
  return ids.length ? ids.join("·") : "—";
}

function slotMinItems(slotId: string): number {
  return STORY_SLOTS.find((s) => s.id === slotId)?.minItems ?? DEFAULT_SLOT_MIN_ITEMS;
}

async function main() {
  const { citySlug, days } = parseArgs(process.argv.slice(2));
  const city = await findCityBySlug(citySlug);
  if (!city) {
    console.error(`City not found: ${citySlug}`);
    process.exit(1);
  }

  const timeZone = getCityTimeZone(city.id);
  const todayKey = zonedDateKey(new Date(), timeZone);
  const startKey = addDateKeyDays(todayKey, -(days - 1));
  const activeSlots = STORY_SLOTS.filter((s) => s.id !== "lastchance");

  console.log(`# Stories rail replay (branch a: today + running)`);
  console.log(`city=${city.slug} (${city.id}) tz=${timeZone}`);
  console.log(`window=${startKey} … ${todayKey} (${days} days)`);
  console.log(
    `slots=${activeSlots.map((s) => s.id).join(",")} deferred=${DEFERRED_STORY_SLOT_IDS.join(",")}`,
  );
  console.log(
    `serialConfig=${JSON.stringify(SERIAL_CLASSIFICATION_CONFIG)}`,
  );
  console.log(
    `minItems default=${DEFAULT_SLOT_MIN_ITEMS} today=${TODAY_SLOT_MIN_ITEMS} renderPolicy=${JSON.stringify(DEFAULT_RENDER_POLICY)}`,
  );
  console.log(``);
  console.log(
    `NOTE: replay uses CURRENT published content projected onto each civil day — estimate, not historical truth.`,
  );
  console.log(
    `NOTE: entity_repeat across many temporal slots is N/A (single temporal). today↔running jaccard is a sanity check.`,
  );
  console.log(
    `NOTE: window policy default is mechanical (always); Minsk dated Offers=0.`,
  );
  console.log(``);

  type DayRow = {
    dateKey: string;
    weekday: string;
    aboveMin: string[];
    afterResolve: string[];
    afterPolicy: string[];
    renderCount: number;
    pointBySlot: Record<string, number>;
    serialBySlot: Record<string, number>;
    windowBySlot: Record<string, number>;
    jaccEntity: Record<string, number | null>;
    jaccItem: Record<string, number | null>;
    visualDupBySlot: Record<string, number | null>;
    classTotals: { point: number; serial: number; window: number };
  };

  const byPolicy: Record<OngoingTemporalPolicy, DayRow[]> = {
    always: [],
    never: [],
    boundary: [],
  };

  for (let i = 0; i < days; i++) {
    const dateKey = addDateKeyDays(startKey, i);
    const now = fromZonedTime(`${dateKey}T12:00:00`, timeZone);
    const wd = WEEKDAYS[weekdayFromDateKey(dateKey)]!;

    for (const policy of POLICIES) {
      const data = await buildStoryRailData({
        cityId: city.id,
        now,
        ongoingPolicy: policy,
        slots: STORY_SLOTS,
        bypassCache: true,
      });

      const breakdownById = new Map(data.stats.map((s) => [s.slot.id, s.breakdown]));
      const aboveMin = data.stats
        .filter((s) => s.breakdown.total >= slotMinItems(s.slot.id))
        .map((s) => s.slot.id);

      const resolved = resolveSlots(
        STORY_SLOTS,
        {
          now,
          timeZone,
          cityId: city.id,
          hasBreakingNews: false,
        },
        data.counts,
      );

      const rendered = applyRenderPolicy(resolved, DEFAULT_RENDER_POLICY);

      const pointBySlot: Record<string, number> = {};
      const serialBySlot: Record<string, number> = {};
      const windowBySlot: Record<string, number> = {};
      const visualDupBySlot: Record<string, number | null> = {};
      const classTotals = { point: 0, serial: 0, window: 0 };

      for (const slot of activeSlots) {
        const b = breakdownById.get(slot.id);
        pointBySlot[slot.id] = b?.point ?? 0;
        serialBySlot[slot.id] = b?.serial ?? 0;
        windowBySlot[slot.id] = b?.window ?? 0;
        classTotals.point += b?.point ?? 0;
        classTotals.serial += b?.serial ?? 0;
        classTotals.window += b?.window ?? 0;
        visualDupBySlot[slot.id] = b ? visualDuplicatePairRate(b.items).rate : null;
      }

      const jaccEntity: Record<string, number | null> = {};
      const jaccItem: Record<string, number | null> = {};
      for (const [a, b] of NEIGHBOR_PAIRS) {
        const itemsA = breakdownById.get(a)?.items ?? [];
        const itemsB = breakdownById.get(b)?.items ?? [];
        jaccEntity[`${a}↔${b}`] = jaccardByParentEntity(itemsA, itemsB);
        jaccItem[`${a}↔${b}`] = jaccardByItemIds(itemsA, itemsB);
      }

      byPolicy[policy].push({
        dateKey,
        weekday: wd,
        aboveMin,
        afterResolve: resolved.map((s) => s.id),
        afterPolicy: rendered.map((s) => s.id),
        renderCount: rendered.length,
        pointBySlot,
        serialBySlot,
        windowBySlot,
        jaccEntity,
        jaccItem,
        visualDupBySlot,
        classTotals,
      });
    }
  }

  for (const policy of POLICIES) {
    const rows = byPolicy[policy];
    console.log(`\n## Policy \`${policy}\` (${policy === "always" ? "a" : policy === "never" ? "b" : "c"})\n`);
    console.log(
      [
        "date",
        "dow",
        "aboveMin",
        "resolved",
        "rendered",
        "n",
        "pt(tod/run)",
        "ser(tod/run)",
        "win(tod/run)",
        "jacc_e tod↔run",
        "jacc_i tod↔run",
        "visDup tod/run",
      ].join(" | "),
    );
    console.log(
      [
        "----",
        "---",
        "--------",
        "--------",
        "--------",
        "-",
        "----------",
        "-----------",
        "-----------",
        "--------------",
        "--------------",
        "-------------",
      ].join(" | "),
    );

    for (const row of rows) {
      const pt = activeSlots.map((s) => row.pointBySlot[s.id] ?? 0).join("/");
      const ser = activeSlots.map((s) => row.serialBySlot[s.id] ?? 0).join("/");
      const win = activeSlots.map((s) => row.windowBySlot[s.id] ?? 0).join("/");
      const je = pct(row.jaccEntity["today↔running"] ?? null);
      const ji = pct(row.jaccItem["today↔running"] ?? null);
      const vdup = activeSlots.map((s) => pct(row.visualDupBySlot[s.id] ?? null)).join("/");
      console.log(
        [
          row.dateKey,
          row.weekday,
          fmtIds(row.aboveMin),
          fmtIds(row.afterResolve),
          fmtIds(row.afterPolicy),
          String(row.renderCount),
          pt,
          ser,
          win,
          je,
          ji,
          vdup,
        ].join(" | "),
      );
    }

    const collapsed = rows.filter((r) => r.renderCount === 0).length;
    const renderedDays = rows.filter((r) => r.renderCount > 0).length;
    const avgN =
      rows.reduce((sum, r) => sum + r.renderCount, 0) / Math.max(rows.length, 1);
    const daysWithToday = rows.filter((r) => r.afterPolicy.includes("today")).length;
    const daysWithRunning = rows.filter((r) => r.afterPolicy.includes("running")).length;
    const avgPointToday =
      rows.reduce((sum, r) => sum + (r.pointBySlot.today ?? 0), 0) / rows.length;
    const avgSerialRunning =
      rows.reduce((sum, r) => sum + (r.serialBySlot.running ?? 0), 0) / rows.length;

    console.log(``);
    console.log(
      `summary: collapsed_days=${collapsed}/${rows.length} rendered_days=${renderedDays}/${rows.length} (${((renderedDays / rows.length) * 100).toFixed(0)}%) avg_rendered=${avgN.toFixed(2)}`,
    );
    console.log(
      `gate_50pct_days: ${renderedDays / rows.length >= 0.5 ? "PASS" : "FAIL"} (need ≥50% days with rail)`,
    );
    console.log(
      `slot_days: today_in_rendered=${daysWithToday}/${rows.length} running_in_rendered=${daysWithRunning}/${rows.length}`,
    );
    console.log(
      `avg_counts: today.point=${avgPointToday.toFixed(2)} running.serial=${avgSerialRunning.toFixed(2)}`,
    );
  }

  console.log(`\n## Policy comparison (collapsed days / avg rendered / gate)\n`);
  console.log(`policy | collapsed | rendered_days | avg_rendered | gate_50pct`);
  console.log(`------ | --------- | ------------- | ------------ | ----------`);
  for (const policy of POLICIES) {
    const rows = byPolicy[policy];
    const collapsed = rows.filter((r) => r.renderCount === 0).length;
    const renderedDays = rows.filter((r) => r.renderCount > 0).length;
    const avgN =
      rows.reduce((sum, r) => sum + r.renderCount, 0) / Math.max(rows.length, 1);
    const gate = renderedDays / rows.length >= 0.5 ? "PASS" : "FAIL";
    console.log(
      `${policy} | ${collapsed}/${rows.length} | ${renderedDays}/${rows.length} | ${avgN.toFixed(2)} | ${gate}`,
    );
  }

  console.log(`\nDone.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
