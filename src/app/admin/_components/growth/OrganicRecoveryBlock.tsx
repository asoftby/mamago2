"use client";

import { useEffect, useRef, useState } from "react";
import { AdminDashboardBlock } from "../AdminDashboardBlock";
import { getDashboardBlock } from "@/lib/admin/dashboardBlocks";
import type { OrganicRecoveryViewModel, OrganicWeekPoint } from "@/lib/admin/growthDashboardViewModel";
import { DeltaPercent, fmtInt, fmtPct } from "./growthFormat";
import { organicRecoveryTooltipRows } from "@/lib/admin/organicRecoveryTooltip";

function weekLabel(isoWeek: string): string {
  return isoWeek.slice(5);
}

function formatGateDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
}

/**
 * Weekly evergreen clicks (bars) against the straight-line path to the gate
 * (dashed). Future weeks show only the path, so the gap is visible at a glance.
 */
function RecoveryChart({ series, latestWeek }: { series: OrganicWeekPoint[]; latestWeek: string | null }) {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!chartRef.current?.contains(event.target as Node)) setSelectedWeek(null);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);
  if (series.length === 0) return null;
  const width = 560;
  const height = 150;
  const top = 8;
  const bottom = 20;
  const plotH = height - top - bottom;
  const slot = width / series.length;
  const barW = Math.min(28, slot * 0.6);
  const max = Math.max(1, ...series.flatMap((p) => [p.actual ?? 0, p.trajectory ?? 0]));
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const cx = (i: number) => slot * i + slot / 2;
  const path = series
    .map((p, i) => (p.trajectory === null ? null : `${cx(i).toFixed(1)},${y(p.trajectory).toFixed(1)}`))
    .filter((pt): pt is string => pt !== null)
    .join(" ");

  const selectedIndex = series.findIndex((point) => point.isoWeek === selectedWeek);
  const selectedPoint = selectedIndex >= 0 ? series[selectedIndex] : null;

  return (
    <div ref={chartRef} className="relative" onMouseLeave={() => setSelectedWeek(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-label="Евергрин-клики по неделям и траектория к цели">
        <line x1={0} x2={width} y1={top + plotH} y2={top + plotH} className="stroke-gray-200" strokeWidth={1} />
        {series.map((p, i) =>
          p.actual === null ? null : (
            <rect
              key={p.isoWeek}
              x={cx(i) - barW / 2}
              y={y(p.actual)}
              width={barW}
              height={Math.max(1, top + plotH - y(p.actual))}
              rx={2}
              className={p.isoWeek === latestWeek ? "fill-indigo-600" : "fill-indigo-300"}
            >
              <title>{`${p.isoWeek}: ${p.actual.toLocaleString("ru-RU")} кликов`}</title>
            </rect>
          ),
        )}
        {path && (
          <polyline points={path} fill="none" className="stroke-gray-400" strokeWidth={1.5} strokeDasharray="4 3" />
        )}
        {series.map((p, i) => (
          <rect
            key={`hit-${p.isoWeek}`}
            x={slot * i}
            y={top}
            width={slot}
            height={plotH}
            fill="transparent"
            role="button"
            tabIndex={0}
            aria-label={`Данные за ${p.isoWeek}`}
            data-recovery-week={p.isoWeek}
            className="cursor-pointer outline-none focus-visible:stroke-indigo-500"
            onMouseEnter={() => setSelectedWeek(p.isoWeek)}
            onFocus={() => setSelectedWeek(p.isoWeek)}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedWeek((current) => current === p.isoWeek ? null : p.isoWeek);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSelectedWeek(null);
            }}
          />
        ))}
        {series.map((p, i) => (
          <text key={p.isoWeek} x={cx(i)} y={height - 5} textAnchor="middle" className="fill-gray-400" fontSize={10}>
            {weekLabel(p.isoWeek)}
          </text>
        ))}
      </svg>
      {selectedPoint ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-2 z-20 w-40 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-lg"
          style={{ left: `clamp(5rem, ${((selectedIndex + 0.5) / series.length) * 100}%, calc(100% - 5rem))` }}
        >
          <div className="mb-1 font-semibold text-gray-900">{selectedPoint.isoWeek}</div>
          {organicRecoveryTooltipRows(selectedPoint).map((row) => (
            <div key={row.label} className="flex justify-between gap-2">
              <span>{row.label}:</span><span className="font-medium text-gray-900">{row.value}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-600" aria-hidden="true" />
          факт за неделю
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4 border-t border-dashed border-gray-400" aria-hidden="true" />
          нужно по плану
        </span>
      </div>
    </div>
  );
}

export function OrganicRecoveryBlock({ model }: { model: OrganicRecoveryViewModel }) {
  const block = getDashboardBlock("organic");
  const progress =
    model.actual !== null && model.gateTargetClicks ? Math.min(1, model.actual / model.gateTargetClicks) : null;

  return (
    <AdminDashboardBlock title={block.title} href={block.href} size={block.size}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-3">
          <div>
            <div className="text-xs text-gray-500">
              Клики из Google на постоянные страницы{model.latestWeek ? ` · ${model.latestWeek}` : ""}
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold text-gray-900">{fmtInt(model.actual)}</span>
              <DeltaPercent value={model.weekChangePercent} suffix="к прошлой неделе" />
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {model.share === null
                ? "Нет базы для этой недели"
                : `${fmtPct(model.share)} от уровня до миграции (${fmtInt(model.baseline)})`}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>
                Цель к {formatGateDate(model.gateDate)}: {fmtInt(model.gateTargetClicks)} ({model.targetSharePercent}% базы)
              </span>
              <span className="font-medium text-gray-700">{progress === null ? "—" : fmtPct(progress)}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${model.onTrack === false ? "bg-red-500" : "bg-green-500"}`}
                style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
              />
            </div>
          </div>

          {model.onTrack !== null && (
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                model.onTrack ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {model.onTrack
                ? "Идём по плану к цели."
                : `Отстаём: по плану сейчас нужно ${fmtPct(model.targetShareNow)} базы, есть ${fmtPct(model.share)}.`}
              {model.requiredWeeklyGrowth !== null && model.weeksLeft !== null && model.weeksLeft > 0 && (
                <span className="block text-xs mt-0.5 opacity-90">
                  Нужный рост: +{Math.round(model.requiredWeeklyGrowth * 100)}% в неделю, осталось {model.weeksLeft} нед.
                </span>
              )}
            </div>
          )}

          <div className="text-xs text-gray-500 space-y-0.5">
            {model.totalClicksLatestWeek !== null && (
              <div>Все клики из Google за ту же неделю, включая афишу: {fmtInt(model.totalClicksLatestWeek)}</div>
            )}
            {model.highNoise && model.weeksMeasured > 0 && (
              <div className="text-amber-700">Измерено недель: {model.weeksMeasured}. До трёх недель одна неделя сильно двигает процент.</div>
            )}
          </div>
        </div>

        <RecoveryChart series={model.series} latestWeek={model.latestWeek} />
      </div>
    </AdminDashboardBlock>
  );
}
