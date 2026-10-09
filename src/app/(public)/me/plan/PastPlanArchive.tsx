"use client";

import Link from "next/link";
import { useState } from "react";
import type { PastPlanEntry } from "@/server/services/experience/pastPlanEntries.service";

function labelForStatus(entry: PastPlanEntry): string {
  if (entry.cancelled) return "Отменено";
  if (entry.attendance === "NOT_ATTENDED") return "Не получилось";
  if (entry.sentiment === "LIKE") return "Понравилось";
  if (entry.sentiment === "NEUTRAL") return "Нормально";
  if (entry.sentiment === "DISLIKE") return "Не понравилось";
  if (entry.attendance === "ATTENDED") return "Ждёт оценки";
  return entry.typeLabel === "Заметка" || entry.typeLabel === "Статья" ? "В истории" : "Не оценено";
}

export function PastPlanArchive({
  entries,
  page,
  hasNext,
  selectedDate,
}: {
  entries: PastPlanEntry[];
  page: number;
  hasNext: boolean;
  selectedDate: string;
}) {
  const [expanded, setExpanded] = useState(page > 0);
  const href = (number: number) => `/me/plan?date=${encodeURIComponent(selectedDate)}&historyPage=${number}#past-plan-history`;
  return (
    <section id="past-plan-history" aria-labelledby="past-plan-history-heading" className="mb-8 rounded-2xl border border-[#E4E0D9] bg-white p-4 sm:p-6">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <span id="past-plan-history-heading" className="text-lg font-semibold text-[#141210]">Прошедшее</span>
        <span className="text-sm font-medium text-[#C24E22]">{expanded ? "Свернуть ↑" : "Посмотреть историю →"}</span>
      </button>
      {expanded && (
        <div className="mt-4">
          {entries.length === 0 ? (
            <p className="text-sm text-[#6B6258]">Пока нет прошедших записей.</p>
          ) : (
            <ul className="divide-y divide-[#E4E0D9]">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="text-xs text-[#6B6258]">{entry.date.split("-").reverse().join(".")} · {entry.typeLabel}</div>
                    <Link href={`/me/plan?date=${entry.date}`} className="mt-1 block truncate text-sm font-semibold text-[#141210] hover:underline">
                      {entry.title}
                    </Link>
                  </div>
                  <span className="shrink-0 text-xs text-[#6B6258]">{labelForStatus(entry)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between gap-3">
            {page > 0 ? <Link href={href(page - 1)} className="text-sm font-semibold text-[#C24E22]">← Новее</Link> : <span />}
            {hasNext ? <Link href={href(page + 1)} className="text-sm font-semibold text-[#C24E22]">Раньше →</Link> : null}
          </div>
        </div>
      )}
    </section>
  );
}
