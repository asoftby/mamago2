"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X } from "lucide-react";

type RangeValue = { from: Date; to: Date };
type WhenValue = string | Date | RangeValue | null;
type WhenSelectProps = {
  label?: string;
  value?: WhenValue;
  onChange?: (val: WhenValue) => void;
  className?: string;
};

function ruMonthAbbr(m: number) {
  const names = ["янв.", "фев.", "мар.", "апр.", "май", "июн.", "июл.", "авг.", "сен.", "окт.", "ноя.", "дек."];
  return names[m] || "";
}

function formatDateAbbr(d: Date) {
  return `${d.getDate()} ${ruMonthAbbr(d.getMonth())}`;
}

function formatRange(from: Date, to: Date) {
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return `${from.getDate()}–${to.getDate()} ${ruMonthAbbr(from.getMonth())}`;
  }
  return `${formatDateAbbr(from)} — ${formatDateAbbr(to)}`;
}

function getWeekendRange(now: Date) {
  const day = now.getDay() === 0 ? 7 : now.getDay();
  const saturday = new Date(now);
  saturday.setDate(now.getDate() + (6 - day));
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  return [saturday, sunday];
}

export function WhenSelect({ label = "Когда идем", value, onChange, className }: WhenSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<WhenValue>(value ?? null);
  const [pendingFrom, setPendingFrom] = React.useState<Date | null>(null);
  const [pendingTo, setPendingTo] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setSelected(value ?? null);
  }, [value]);
  const now = React.useMemo(() => new Date(), []);
  const today = now;
  const tomorrow = React.useMemo(() => {
    const t = new Date(now);
    t.setDate(now.getDate() + 1);
    return t;
  }, [now]);
  const [weekStart, weekEnd] = React.useMemo(() => getWeekendRange(now), [now]);

  const [month, setMonth] = React.useState(now.getMonth());
  const [year, setYear] = React.useState(now.getFullYear());
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() === 0 ? 7 : firstDay.getDay()) - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weekendRangeText = formatRange(weekStart, weekEnd);
  const displayText = (() => {
    if (pendingFrom && pendingTo) {
      return formatRange(pendingFrom, pendingTo);
    }
    if (pendingFrom) {
      return `${formatDateAbbr(pendingFrom)}`;
    }
    if (selected && typeof selected === "object" && "from" in selected && "to" in selected) {
      return formatRange(selected.from, selected.to);
    }
    if (selected instanceof Date) {
      return formatDateAbbr(selected);
    }
    if (selected === "today") return `Сегодня • ${formatDateAbbr(today)}`;
    if (selected === "tomorrow") return `Завтра • ${formatDateAbbr(tomorrow)}`;
    if (selected === "weekend") return `Эти выходные • ${weekendRangeText}`;
    return "Выберите...";
  })();

  const setVal = (v: WhenValue) => {
    setSelected(v);
    onChange?.(v);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVal(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "gap-2 whitespace-nowrap text-sm disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive shadow-xs hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 has-[>svg]:px-3 h-auto min-h-[56px] w-full justify-between rounded-full border bg-background px-5 py-3 hover:bg-muted/30 transition-all flex items-center text-left font-normal",
            value && "border-primary bg-primary/5",
            className
          )}
        >
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="text-xs text-muted-foreground font-medium truncate">{label}</span>
            <span className="text-sm truncate text-muted-foreground">{displayText}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {selected && (
              <div
                role="button"
                tabIndex={0}
                onClick={handleClear}
                className="rounded-full p-0.5 hover:bg-black/10 transition-colors pointer-events-auto"
              >
                <X className="h-4 w-4" />
              </div>
            )}
            <svg className="h-4 w-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="m6 9 6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[720px] min-h-[350px] h-auto overflow-y-auto p-4 rounded-[24px] bg-card shadow-md border">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <button
              className="w-full text-left border rounded-2xl px-4 py-3 hover:bg-muted/40"
              onClick={() => setVal("today")}
            >
              <div className="font-semibold">Сегодня</div>
              <div className="text-sm text-muted-foreground">{formatDateAbbr(today)}</div>
            </button>
            <button
              className="w-full text-left border rounded-2xl px-4 py-3 hover:bg-muted/40"
              onClick={() => setVal("tomorrow")}
            >
              <div className="font-semibold">Завтра</div>
              <div className="text-sm text-muted-foreground">{formatDateAbbr(tomorrow)}</div>
            </button>
            <button
              className="w-full text-left border rounded-2xl px-4 py-3 hover:bg-muted/40"
              onClick={() => setVal("weekend")}
            >
              <div className="font-semibold">Эти выходные</div>
              <div className="text-sm text-muted-foreground">
                {weekendRangeText}
              </div>
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <button
                className="h-8 w-8 rounded-full hover:bg-muted/40 flex items-center justify-center"
                onClick={() => {
                  const nm = month - 1;
                  if (nm < 0) {
                    setMonth(11);
                    setYear((y) => y - 1);
                  } else setMonth(nm);
                }}
                aria-label="Prev"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M15 18l-6-6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="text-base font-semibold">
                {new Date(year, month, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
              </div>
              <button
                className="h-8 w-8 rounded-full hover:bg-muted/40 flex items-center justify-center"
                onClick={() => {
                  const nm = month + 1;
                  if (nm > 11) {
                    setMonth(0);
                    setYear((y) => y + 1);
                  } else setMonth(nm);
                }}
                aria-label="Next"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M9 6l6 6-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
              {["п", "в", "с", "ч", "п", "с", "в"].map((w, i) => (
                <div key={i} className="py-1">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startOffset }).map((_, i) => (
                <div key={`e-${i}`} className="h-9" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = new Date(year, month, i + 1);
                const isToday =
                  d.getDate() === now.getDate() &&
                  d.getMonth() === now.getMonth() &&
                  d.getFullYear() === now.getFullYear();
                const isInPendingRange =
                  pendingFrom &&
                  pendingTo &&
                  d >= pendingFrom &&
                  d <= pendingTo;
                const isPendingStart = pendingFrom && d.getTime() === pendingFrom.getTime();
                const isPendingEnd = pendingTo && d.getTime() === pendingTo.getTime();
                return (
                  <button
                    key={i}
                    className={cn(
                      "h-9 rounded-full text-sm hover:bg-muted/40",
                      isToday && "text-foreground font-semibold",
                      isInPendingRange && "bg-muted",
                      isPendingStart && "bg-primary/20",
                      isPendingEnd && "bg-primary/30"
                    )}
                    onClick={() => {
                      if (!pendingFrom) {
                        setPendingFrom(d);
                        setPendingTo(null);
                      } else if (pendingFrom && !pendingTo) {
                        if (d < pendingFrom) {
                          setPendingFrom(d);
                          setPendingTo(null);
                        } else {
                          setPendingTo(d);
                        }
                      } else {
                        setPendingFrom(d);
                        setPendingTo(null);
                      }
                    }}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            {(pendingFrom || pendingTo) && (
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="h-9 px-4 rounded-full border hover:bg-muted/40 text-sm"
                  onClick={() => {
                    setPendingFrom(null);
                    setPendingTo(null);
                  }}
                >
                  Сбросить
                </button>
                <button
                  className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm hover:bg-primary/90"
                  onClick={() => {
                    if (pendingFrom && pendingTo) {
                      const range: RangeValue = { from: pendingFrom, to: pendingTo };
                      setSelected(range);
                      onChange?.(range);
                      setOpen(false);
                    } else if (pendingFrom) {
                      setSelected(pendingFrom);
                      onChange?.(pendingFrom);
                      setOpen(false);
                    }
                  }}
                  disabled={!pendingFrom}
                >
                  Применить
                </button>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
