"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverPanelContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHydrated } from "@/hooks/use-hydrated";
import { Button } from "@/components/ui/button";

type RangeValue = { from: Date; to: Date };
type WhenValue = string | Date | RangeValue | null;
type WhenSelectProps = {
  label?: string;
  value?: WhenValue;
  onChange?: (val: WhenValue) => void;
  className?: string;
  variant?: "default" | "embedded";
  uiMode?: "mobile" | "desktop";
  trigger?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  errorText?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

// Safe date validation helper
function isValidDate(d: any): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function ruMonthAbbr(m: number) {
  const names = ["янв.", "фев.", "мар.", "апр.", "май", "июн.", "июл.", "авг.", "сен.", "окт.", "ноя.", "дек."];
  return names[m] || "";
}

function formatDateAbbr(d: Date) {
  if (!isValidDate(d)) return "";
  return `${d.getDate()} ${ruMonthAbbr(d.getMonth())}`;
}

function formatRange(from: Date, to: Date) {
  if (!isValidDate(from) || !isValidDate(to)) return "";
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

export function WhenSelect({
  label = "Когда идем",
  value,
  onChange,
  className,
  variant = "default",
  uiMode,
  trigger,
  placeholder = "Выберите...",
  disabled = false,
  loading = false,
  errorText,
  open: openProp,
  defaultOpen,
  onOpenChange,
}: WhenSelectProps) {
  const [isClient, setIsClient] = React.useState(false);
  const hydrated = useHydrated();
  const isMobileQuery = useIsMobile();
  // Gate mobile detection until after hydration to prevent SSR/CSR mismatch
  // During SSR and first render, always use desktop variant (Popover)
  const isMobile = uiMode ? uiMode === "mobile" : (hydrated && isMobileQuery);
  const isControlled = value !== undefined;
  
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // If embedded, we ignore internal open state and render content directly
  const [openUncontrolled, setOpenUncontrolled] = React.useState(defaultOpen ?? false);
  const open = openProp ?? openUncontrolled;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (openProp === undefined) setOpenUncontrolled(v);
  };
  const [selectedState, setSelectedState] = React.useState<WhenValue>(value ?? null);
  const selected: WhenValue = isControlled ? (value ?? null) : selectedState;
  const [pendingFrom, setPendingFrom] = React.useState<Date | null>(null);
  const [pendingTo, setPendingTo] = React.useState<Date | null>(null);
  const [activePreset, setActivePreset] = React.useState<"today" | "tomorrow" | "weekend" | null>(null);

  const now = React.useMemo(() => new Date(), []);
  const today = now;
  const tomorrow = React.useMemo(() => {
    const t = new Date(now);
    t.setDate(now.getDate() + 1);
    return t;
  }, [now]);
  const [weekStart, weekEnd] = React.useMemo(() => getWeekendRange(now), [now]);

  // Sync pending with selected when opening or if embedded
  React.useEffect(() => {
    if (open || variant === "embedded") {
      if (!selected) {
        setPendingFrom(null);
        setPendingTo(null);
        setActivePreset(null);
      } else if (selected instanceof Date) {
        // Validate date before using
        if (!isValidDate(selected)) {
          setPendingFrom(null);
          setPendingTo(null);
          setActivePreset(null);
          return;
        }
        
        setPendingFrom(selected);
        setPendingTo(null);
        // Check if matches today/tomorrow
        if (selected.getDate() === today.getDate() && selected.getMonth() === today.getMonth() && selected.getFullYear() === today.getFullYear()) {
          setActivePreset("today");
        } else if (selected.getDate() === tomorrow.getDate() && selected.getMonth() === tomorrow.getMonth() && selected.getFullYear() === tomorrow.getFullYear()) {
          setActivePreset("tomorrow");
        } else {
          setActivePreset(null);
        }
      } else if (typeof selected === 'object' && 'from' in selected) {
        // Validate range dates before using
        if (!isValidDate(selected.from) || !isValidDate(selected.to)) {
          setPendingFrom(null);
          setPendingTo(null);
          setActivePreset(null);
          return;
        }
        
        setPendingFrom(selected.from);
        setPendingTo(selected.to);
        // Check if matches weekend
        if (selected.from.getDate() === weekStart.getDate() && selected.from.getMonth() === weekStart.getMonth() && selected.to.getDate() === weekEnd.getDate() && selected.to.getMonth() === weekEnd.getMonth()) {
          setActivePreset("weekend");
        } else {
          setActivePreset(null);
        }
      } else if (selected === "today") {
        setPendingFrom(today);
        setPendingTo(null);
        setActivePreset("today");
      } else if (selected === "tomorrow") {
        setPendingFrom(tomorrow);
        setPendingTo(null);
        setActivePreset("tomorrow");
      } else if (selected === "weekend") {
        setPendingFrom(weekStart);
        setPendingTo(weekEnd);
        setActivePreset("weekend");
      }
    }
  }, [open, selected, today, tomorrow, weekStart, weekEnd, variant]);

  const [month, setMonth] = React.useState(now.getMonth());
  const [year, setYear] = React.useState(now.getFullYear());
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() === 0 ? 7 : firstDay.getDay()) - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weekendRangeText = formatRange(weekStart, weekEnd);
  
  // For internal calendar/sheet UI, use effectiveValue (includes draft)
  const effectiveValue: WhenValue = (open || variant === "embedded")
    ? ((pendingFrom || pendingTo)
        ? (pendingFrom && pendingTo ? { from: pendingFrom, to: pendingTo } : pendingFrom)
        : selected)
    : selected;
  
  // For trigger display, ALWAYS use committed value (props.value), not draft
  const displayText = (() => {
    const displayValue = selected; // Use committed value for display
    
    if (displayValue && typeof displayValue === "object" && "from" in displayValue && "to" in displayValue) {
      // Validate range dates
      if (!isValidDate(displayValue.from) || !isValidDate(displayValue.to)) {
        return placeholder;
      }
      return formatRange(displayValue.from, displayValue.to) || placeholder;
    }
    if (displayValue instanceof Date) {
      // Validate single date
      if (!isValidDate(displayValue)) {
        return placeholder;
      }
      return formatDateAbbr(displayValue) || placeholder;
    }
    if (displayValue === "today") {
      const formatted = formatDateAbbr(today);
      return formatted ? `Сегодня • ${formatted}` : "Сегодня";
    }
    if (displayValue === "tomorrow") {
      const formatted = formatDateAbbr(tomorrow);
      return formatted ? `Завтра • ${formatted}` : "Завтра";
    }
    if (displayValue === "weekend") {
      return weekendRangeText ? `Эти выходные • ${weekendRangeText}` : "Эти выходные";
    }
    return placeholder;
  })();

  const setVal = (v: WhenValue) => {
    if (!isControlled) setSelectedState(v);
    onChange?.(v);
    if (!isMobile) {
      setOpen(false);
    }
  };

  const handleMobilePreset = (type: "today" | "tomorrow" | "weekend") => {
    setActivePreset(type);
    if (type === "today") {
      setPendingFrom(today);
      setPendingTo(null);
    } else if (type === "tomorrow") {
      setPendingFrom(tomorrow);
      setPendingTo(null);
    } else if (type === "weekend") {
      setPendingFrom(weekStart);
      setPendingTo(weekEnd);
    }

    if (variant === "embedded") {
      onChange?.(type);
    }
  };

  const handleMobileApply = () => {
    if (pendingFrom && pendingTo) {
      const range = { from: pendingFrom, to: pendingTo };
      setVal(range);
    } else if (pendingFrom) {
      setVal(pendingFrom);
    }
    setOpen(false);
  };

  const clearAllInternal = () => {
    setPendingFrom(null);
    setPendingTo(null);
    setActivePreset(null);
  };
  const handleMobileReset = () => {
    clearAllInternal();
    setVal(null);
  };

  const handleClear = () => {
    clearAllInternal();
    setVal(null);
  };

  const handleDateClick = (d: Date) => {
    setActivePreset(null);
    let newFrom = pendingFrom;
    let newTo = pendingTo;

    if (!pendingFrom) {
      newFrom = d;
      newTo = null;
    } else if (pendingFrom && !pendingTo) {
      if (d < pendingFrom) {
        newFrom = d;
        newTo = null;
      } else {
        newTo = d;
      }
    } else {
      newFrom = d;
      newTo = null;
    }

    setPendingFrom(newFrom);
    setPendingTo(newTo);

    if (variant === "embedded") {
        if (newFrom && newTo) {
            onChange?.({ from: newFrom, to: newTo });
        } else if (newFrom) {
            onChange?.(newFrom);
        } else {
            onChange?.(null);
        }
    }
  };

  const triggerButton = (
    <button
      type="button"
      className={cn(
        "gap-2 whitespace-nowrap text-sm disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive shadow-xs hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 has-[>svg]:px-3 h-auto min-h-[56px] w-full justify-between rounded-full border bg-background px-5 py-3 hover:bg-muted/30 transition-all flex items-center text-left font-normal",
        value && "border-primary bg-primary/5",
        errorText && "aria-invalid",
        className
      )}
      aria-invalid={!!errorText}
      disabled={disabled || loading}
    >
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-xs text-muted-foreground font-medium truncate">{label}</span>
        <span className="text-sm truncate text-muted-foreground">{displayText}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {loading && (
          <svg className="h-4 w-4 animate-spin opacity-60" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
            <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" />
          </svg>
        )}
        {selected && !loading && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleClear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                handleClear();
              }
            }}
            className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Сбросить"
          >
            <X className="h-4 w-4" />
          </span>
        )}
        <svg className={cn("h-4 w-4 opacity-50 transition-transform", open && "rotate-180")} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="m6 9 6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </button>
  );

  const renderCalendar = () => {
    // Create today at midnight for accurate past date comparison
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    return (
      <div className="space-y-4 pb-4">
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
            <ChevronLeft className="h-4 w-4" />
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
            <ChevronRight className="h-4 w-4" />
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
            const isPast = d < todayStart;
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
                  "h-9 rounded-full text-sm transition-colors",
                  isPast && "opacity-50 text-muted-foreground cursor-not-allowed pointer-events-none",
                  !isPast && "hover:bg-muted/40",
                  isToday && !isPast && "text-foreground font-semibold",
                  isInPendingRange && !isPast && "bg-muted",
                  isPendingStart && !isPast && "bg-primary/20",
                  isPendingEnd && !isPast && "bg-primary/30"
                )}
                onClick={() => !isPast && handleDateClick(d)}
                disabled={isPast}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const desktopContent = (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-3">
        <button
          className="w-full text-left border rounded-2xl px-4 py-3 hover:bg-muted/40 transition-colors"
          onClick={() => setVal("today")}
        >
          <div className="font-semibold">Сегодня</div>
          <div className="text-sm text-muted-foreground">{formatDateAbbr(today)}</div>
        </button>
        <button
          className="w-full text-left border rounded-2xl px-4 py-3 hover:bg-muted/40 transition-colors"
          onClick={() => setVal("tomorrow")}
        >
          <div className="font-semibold">Завтра</div>
          <div className="text-sm text-muted-foreground">{formatDateAbbr(tomorrow)}</div>
        </button>
        <button
          className="w-full text-left border rounded-2xl px-4 py-3 hover:bg-muted/40 transition-colors"
          onClick={() => setVal("weekend")}
        >
          <div className="font-semibold">Эти выходные</div>
          <div className="text-sm text-muted-foreground">
            {weekendRangeText}
          </div>
        </button>
      </div>
      <div className="flex flex-col gap-4">
        {renderCalendar()}
        {(pendingFrom || pendingTo) && (
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setPendingFrom(null);
                setPendingTo(null);
              }}
            >
              Сбросить
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                if (pendingFrom && pendingTo) {
                  const range: RangeValue = { from: pendingFrom, to: pendingTo };
                  setVal(range);
                } else if (pendingFrom) {
                  setVal(pendingFrom);
                }
              }}
              disabled={!pendingFrom}
            >
              Применить
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  if (variant === "embedded") {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        {/* Presets Row */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide shrink-0">
          <button 
            onClick={() => handleMobilePreset("today")} 
            className={cn(
              "px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap active:scale-95 transition-transform",
              activePreset === "today" ? "bg-primary text-primary-foreground border-primary" : "bg-background"
            )}
          >
            Сегодня
          </button>
          <button 
            onClick={() => handleMobilePreset("tomorrow")} 
            className={cn(
              "px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap active:scale-95 transition-transform",
              activePreset === "tomorrow" ? "bg-primary text-primary-foreground border-primary" : "bg-background"
            )}
          >
            Завтра
          </button>
          <button 
            onClick={() => handleMobilePreset("weekend")} 
            className={cn(
              "px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap active:scale-95 transition-transform",
              activePreset === "weekend" ? "bg-primary text-primary-foreground border-primary" : "bg-background"
            )}
          >
            На выходных
          </button>
        </div>

        {/* Calendar */}
        {renderCalendar()}
      </div>
    );
  }

  // Render mobile variant (Sheet) only after hydration
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {trigger || triggerButton}
        </SheetTrigger>
        <SheetContent 
          side="bottom" 
          showCloseButton={false}
          className="fixed inset-x-0 bottom-0 w-full max-h-[85vh] rounded-t-3xl bg-background border-t border-border/60 shadow-2xl p-0 flex flex-col overflow-hidden gap-0"
        >
          {/* Header */}
          <div className="flex items-center justify-center p-4 border-b border-border/40 relative">
            <SheetTitle>Дата</SheetTitle>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 pb-0">
            {/* Presets Row */}
            <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide shrink-0">
              <button 
                onClick={() => handleMobilePreset("today")} 
                className={cn(
                  "px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap active:scale-95 transition-transform",
                  activePreset === "today" ? "bg-primary text-primary-foreground border-primary" : "bg-background"
                )}
              >
                Сегодня
              </button>
              <button 
                onClick={() => handleMobilePreset("tomorrow")} 
                className={cn(
                  "px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap active:scale-95 transition-transform",
                  activePreset === "tomorrow" ? "bg-primary text-primary-foreground border-primary" : "bg-background"
                )}
              >
                Завтра
              </button>
              <button 
                onClick={() => handleMobilePreset("weekend")} 
                className={cn(
                  "px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap active:scale-95 transition-transform",
                  activePreset === "weekend" ? "bg-primary text-primary-foreground border-primary" : "bg-background"
                )}
              >
                На выходных
              </button>
            </div>

            {/* Calendar */}
            {renderCalendar()}
          </div>

          {/* Sticky Footer Action Bar */}
          <div className="border-t border-border/60 bg-background/95 backdrop-blur p-4 pb-[calc(16px+env(safe-area-inset-bottom))] flex items-center justify-between shrink-0">
            <button 
              onClick={handleMobileReset}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Сбросить
            </button>
            <Button 
              onClick={handleMobileApply}
              variant="default"
              className="rounded-full shadow-lg active:scale-95 transition-all px-8 font-semibold"
            >
              Готово
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || triggerButton}
      </PopoverTrigger>
      <PopoverPanelContent 
        className="w-[720px] min-h-[350px] h-auto max-h-[80vh] overflow-auto bg-card p-6" 
        align="start"
      >
        {desktopContent}
      </PopoverPanelContent>
    </Popover>
  );
}
