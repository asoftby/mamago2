"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrganizerRequestPreview } from "../lib/buildPartyScenario";

export type OrganizerReviewRow = {
  key: string;
  businessName: string;
  preview: OrganizerRequestPreview;
  isSelected: boolean;
  onToggleSelected: () => void;
};

type Props = {
  rows: OrganizerReviewRow[];
  /** Только одна карточка раскрыта (аккордеон) */
  onEdit: (organizerKey: string) => void;
};

function serviceCountLabel(n: number): string {
  if (n === 1) return "1 услуга";
  if (n >= 2 && n <= 4) return `${n} услуги`;
  return `${n} услуг`;
}

export function OrganizerRequestReviewCards({ rows, onEdit }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const toggleExpand = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const { key, businessName, preview, isSelected, onToggleSelected } =
          row;
        const expanded = expandedKey === key;
        const n = preview.services.length;
        const range = `${preview.requestStartHHmm}–${preview.requestEndHHmm}`;

        return (
          <div
            key={key}
            className={cn(
              "rounded-2xl border bg-white transition-[box-shadow,border-color]",
              isSelected
                ? "border-[#EF8759]/45 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                : "border-border/60",
            )}
          >
            <div className="px-3.5 py-3 sm:px-4 sm:py-3.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex min-w-0 flex-1 gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelected();
                    }}
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                      isSelected
                        ? "border-[#EF8759] bg-[#EF8759]"
                        : "border-border bg-white hover:border-[#EF8759]/50",
                    )}
                    aria-pressed={isSelected}
                    aria-label={
                      isSelected
                        ? "Убрать организатора из заявки"
                        : "Включить организатора в заявку"
                    }
                  >
                    {isSelected ? (
                      <svg
                        viewBox="0 0 20 20"
                        fill="white"
                        className="h-full w-full p-0.5"
                        aria-hidden
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : null}
                  </button>

                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[15px] font-semibold leading-snug text-foreground">
                      {businessName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {serviceCountLabel(n)}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      <span aria-hidden className="mr-1">
                        🕒
                      </span>
                      {range}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 sm:shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleExpand(key)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-[#EF8759] hover:underline"
                  >
                    {expanded ? "Скрыть детали" : "Показать детали"}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        expanded && "rotate-180",
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(key)}
                    className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Изменить
                  </button>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out",
                expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="border-t border-border/40 px-3.5 pb-3.5 pt-2 sm:px-4 sm:pb-4">
                  <ul className="space-y-2">
                    {preview.services.map((s) => (
                      <li
                        key={s.offerId}
                        className="text-sm leading-snug text-foreground/90"
                      >
                        <span className="text-muted-foreground" aria-hidden>
                          •{" "}
                        </span>
                        <span className="font-medium">{s.title}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          — {s.startHHmm}–{s.endHHmm}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
