"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, Clock3, Plus, Users, X } from "lucide-react";
import { requestPlanRefetchForDate } from "@/lib/my-plan/myPlanOpenIntent";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { formatHHMM } from "@/lib/formatters/date";
import { detectPlanItemCategory } from "../../lib/planItemCategory";
import type { PlanItemWithActivity } from "../../types/event";
import {
  PLAN_CHIP,
  PLAN_CHIP_DISABLED,
  PLAN_CHIP_OFF,
  PLAN_CHIP_ON,
  PLAN_FOCUS,
} from "./planChipStyles";
import { planParticipantPalette } from "../PlanParticipantChip";

export type PlanNewTaskPerson = { id: string; name: string; kind: "adult" | "child" };

/** Quick reminder presets; a custom offset supports up to 24 hours. */
const REMIND_OPTIONS: Array<{ minutes: number | null; label: string }> = [
  { minutes: null, label: "Не напоминать" },
  { minutes: 15, label: "За 15 минут" },
  { minutes: 60, label: "За час" },
  { minutes: 120, label: "За 2 часа" },
  { minutes: 1440, label: "За день" },
];

/** Единицы своего напоминания: максимум 4 недели (как на сервере). */
const LEAD_UNITS = [
  { key: "minutes", max: 59, forms: ["минуту", "минуты", "минут"] },
  { key: "hours", max: 23, forms: ["час", "часа", "часов"] },
  { key: "days", max: 28, forms: ["день", "дня", "дней"] },
  { key: "weeks", max: 4, forms: ["неделю", "недели", "недель"] },
] as const;

function leadPlural(n: number, forms: readonly [string, string, string]): string {
  const m = n % 10;
  const h = n % 100;
  return m === 1 && h !== 11 ? forms[0] : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? forms[1] : forms[2];
}

const WHEEL_ROW = 40;

/** Колесо выбора: прокрутка с примагничиванием, значение под подсветкой посередине. */
function Wheel({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: string[];
  value: number;
  onChange: (index: number) => void;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / WHEEL_ROW) !== value) el.scrollTop = value * WHEEL_ROW;
  }, [value, items.length]);
  const onScroll = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const index = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / WHEEL_ROW)));
      if (index !== value) onChange(index);
    }, 90);
  };
  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          onChange(Math.min(items.length - 1, value + 1));
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          onChange(Math.max(0, value - 1));
        }
      }}
      className="relative h-[200px] snap-y snap-mandatory overflow-y-auto outline-none [mask-image:linear-gradient(transparent,#000_35%,#000_65%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="py-[80px]">
        {items.map((text, index) => (
          <button
            key={index}
            type="button"
            role="option"
            aria-selected={index === value}
            onClick={() => onChange(index)}
            className={cn(
              "block h-10 w-full snap-center text-[18px] tabular-nums",
              index === value ? "font-bold text-[var(--mp-tx)]" : "font-medium text-[var(--mp-tx2)]",
              className,
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

const WD = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
type RepeatFrequency = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
type RepeatEnd = "NEVER" | "UNTIL" | "COUNT";

function weekdayOf(isoDate: string): number {
  const weekday = new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function addDays(dateIso: string, n: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d! + n);
  return iso(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
function weekdayLong(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const name = new Date(y!, m! - 1, d!).toLocaleDateString("ru-RU", { weekday: "long" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}
function weekdayShort(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("ru-RU", { weekday: "short" });
}
function maskTime(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}
function longDay(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

const SECTION_LABEL = "mp-font-ui mx-0.5 mb-2.5 text-[15px] font-semibold tracking-[-.01em] text-[var(--mp-tx)]";

/**
 * «Новое дело» в той же шторке: текст → когда → время → для кого → напомнить.
 * Сохраняет через существующий POST /api/plan/manual (без разбора текста и тегов).
 * С `editItem` — перенос своей заметки или записи Telegram: та же форма,
 * предзаполненная, PATCH на endpoint соответствующего источника.
 */
export function PlanNewTaskScreen({
  todayIso,
  initialDate,
  people,
  editItem,
  onBack,
  onSaved,
}: {
  todayIso: string;
  initialDate: string;
  people: PlanNewTaskPerson[];
  /** Своя заметка или запись бота, которую переносят (режим редактирования). */
  editItem?: PlanItemWithActivity | null;
  onBack: () => void;
  onSaved: (date: string) => void;
}) {
  const tomorrowIso = useMemo(() => addDays(todayIso, 1), [todayIso]);
  /** Взрослый в профиле выводится как «Я» (как в «Мой план»), а не логином; остальные — по имени. */
  const firstAdultId = useMemo(() => people.find((p) => p.kind === "adult")?.id ?? null, [people]);
  const initialWhen = initialDate === todayIso ? "today" : initialDate === tomorrowIso ? "tomorrow" : "other";
  const isMove = Boolean(editItem);
  const [text, setText] = useState(editItem?.title ?? "");
  const [when, setWhen] = useState<"today" | "tomorrow" | "other">(initialWhen);
  const [pickedDate, setPickedDate] = useState<string | null>(initialWhen === "other" ? initialDate : null);
  const [timed, setTimed] = useState(Boolean(editItem?.startsAt));
  const [time, setTime] = useState(editItem?.startsAt ? formatHHMM(editItem.startsAt) : "");
  /** "" = вся семья; иначе id персоны (ребёнок → childId, взрослый → assigneeUserId). */
  const [whoId, setWhoId] = useState<string>(editItem?.childId ?? editItem?.assigneeUserId ?? "");
  const [lead, setLead] = useState<number | null>(
    editItem?.startsAt && editItem.reminderEnabled ? (editItem.reminderLeadMinutes ?? null) : null,
  );
  const initialCustomLead = editItem?.reminderLeadMinutes != null &&
    !REMIND_OPTIONS.some((option) => option.minutes === editItem.reminderLeadMinutes)
      ? editItem.reminderLeadMinutes : null;
  const [customLeadOpen, setCustomLeadOpen] = useState(initialCustomLead != null);
  const initialLeadUnit = initialCustomLead != null && initialCustomLead % 10080 === 0 ? "weeks" : initialCustomLead != null && initialCustomLead % 1440 === 0 ? "days" : initialCustomLead != null && initialCustomLead % 60 === 0 ? "hours" : "minutes";
  const leadFactors = { minutes: 1, hours: 60, days: 1440, weeks: 10080 } as const;
  const [customLeadUnit, setCustomLeadUnit] = useState<keyof typeof leadFactors>(initialLeadUnit);
  const [customLeadValue, setCustomLeadValue] = useState(initialCustomLead == null ? "" : String(initialCustomLead / leadFactors[initialLeadUnit]));
  const [leadTouched, setLeadTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [repeat, setRepeat] = useState<RepeatFrequency>("NONE");
  const [repeatEnd, setRepeatEnd] = useState<RepeatEnd>("NEVER");
  const [repeatUntil, setRepeatUntil] = useState(initialDate);
  const [repeatUntilTime, setRepeatUntilTime] = useState("");
  const [repeatCount, setRepeatCount] = useState("10");
  const [repeatDays, setRepeatDays] = useState<number[]>([weekdayOf(initialDate)]);
  // Keep a stable key if the network fails and the user retries.
  const recurrenceRequestKey = useRef<string | null>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // Экран монтируется за краем обрезанной дорожки слайда: нативный autoFocus прокручивает её к полю
  // и форма съезжает влево, поэтому фокус ставим без прокрутки.
  useEffect(() => {
    if (isMove) return;
    textRef.current?.focus({ preventScroll: true });
  }, [isMove]);

  const [ty, tm] = todayIso.split("-").map(Number);
  const [monthOffset, setMonthOffset] = useState(0);
  const [calOpen, setCalOpen] = useState(false);
  const monthDate = new Date(ty!, tm! - 1 + monthOffset, 1);
  const monthLabel = monthDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const leadBlanks = (monthDate.getDay() + 6) % 7;
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: leadBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const day = when === "today" ? todayIso : when === "tomorrow" ? tomorrowIso : pickedDate;
  const timeValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const pastToday = timed && timeValid && day === todayIso && time < new Date().toTimeString().slice(0, 5);
  const customLeadTotal = Number(customLeadValue) * leadFactors[customLeadUnit];
  const leadUnit = LEAD_UNITS.find((u) => u.key === customLeadUnit) ?? LEAD_UNITS[0];
  const leadValue = Math.max(1, Math.min(leadUnit.max, Math.round(Number(customLeadValue)) || 1));
  /** Свой срок выбран: lead не совпадает ни с одним быстрым вариантом. */
  const customActive = timed && lead !== null && (customLeadOpen || !REMIND_OPTIONS.some((option) => option.minutes === lead));
  const customLeadValid = !timed || !customLeadOpen || (
    Number.isInteger(Number(customLeadValue)) && Number.isSafeInteger(customLeadTotal) &&
    customLeadTotal >= 1 && customLeadTotal <= 28 * 1440
  );
  const effectiveUntilDate = repeatEnd === "UNTIL" && repeatUntilTime && timed && timeValid && repeatUntilTime < time
    ? new Date(Date.parse(repeatUntil + "T00:00:00Z") - 86400000).toISOString().slice(0, 10)
    : repeatUntil;
  const repeatValid = repeat === "NONE" || Boolean(day &&
    (repeat !== "WEEKLY" || repeatDays.includes(weekdayOf(day))) &&
    (repeatEnd !== "UNTIL" || (effectiveUntilDate >= day && (!repeatUntilTime || /^([01]\d|2[0-3]):[0-5]\d$/.test(repeatUntilTime)))) &&
    (repeatEnd !== "COUNT" || (/^[0-9]+$/.test(repeatCount) && Number(repeatCount) >= 1 && Number(repeatCount) <= 10000)));
  const can = Boolean(text.trim() && day && (!timed || timeValid) && customLeadValid && repeatValid);
  const whenWord = when === "today" ? "сегодня" : when === "tomorrow" ? "завтра" : day ? longDay(day) : "";
  const label = !text.trim()
    ? "Напишите, что нужно сделать"
    : !day
      ? "Выберите день"
      : timed && !timeValid
        ? "Укажите время"
        : isMove
          ? "Перенести"
          : `Добавить на ${whenWord}${timed ? ` в ${time}` : ""}`;

  function enableTime() {
    setTimed(true);
    // Как в дизайне: со временем напоминание включено по умолчанию («за час»), пока человек не выбрал сам.
    if (!leadTouched && lead === null) setLead(60);
  }

  function displayName(p: PlanNewTaskPerson): string {
    return p.id !== "" && p.id === firstAdultId ? "Я" : p.name;
  }

  async function submit() {
    if (!can || !day || saving) return;
    const who = people.find((p) => p.id === whoId) ?? null;
    setSaving(true);
    try {
      const fields = {
        title: text.trim(),
        date: day,
        startsAt: timed ? time : null,
        childId: who?.kind === "child" ? who.id : null,
        assigneeUserId: who?.kind === "adult" ? who.id : null,
        reminderEnabled: timed && lead !== null,
        reminderLeadMinutes: timed ? lead : null,
      };
      // Перенос: нетронутое напоминание (в т.ч. «по умолчанию», lead = null) не перезаписываем.
      const moveFields = editItem
        ? (() => {
            const { reminderEnabled, reminderLeadMinutes, ...rest } = fields;
            const keepReminder = timed && !leadTouched && Boolean(editItem.startsAt);
            const startChanged = !timed || time !== (editItem.startsAt ? formatHHMM(editItem.startsAt) : "");
            return {
              ...rest,
              ...(keepReminder ? {} : { reminderEnabled, reminderLeadMinutes }),
              // Старый конец не совпадёт с новым началом — сбрасываем.
              ...(editItem.endsAt && startChanged ? { endsAt: null } : {}),
            };
          })()
        : fields;
      const recurrence = repeat !== "NONE" && day ? {
        frequency: repeat,
        interval: 1,
        startDate: day,
        weekdays: repeat === "WEEKLY" ? [...repeatDays].sort((a, b) => a - b) : [],
        untilDate: repeatEnd === "UNTIL" ? effectiveUntilDate : null,
        maxOccurrences: repeatEnd === "COUNT" ? Number(repeatCount) : null,
      } : null;
      if (!editItem && recurrence && !recurrenceRequestKey.current) {
        recurrenceRequestKey.current = crypto.randomUUID().replaceAll("-", "");
      }
      const response = editItem
        ? await fetch(`/api/plan/${editItem.source === "TELEGRAM_FORWARD" ? "telegram" : "manual"}/${editItem.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              ...moveFields,
              expectedUpdatedAt: new Date(editItem.updatedAt ?? Date.now()).toISOString(),
            }),
          })
        : await fetch(recurrence ? "/api/plan/manual/recurring" : "/api/plan/manual", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "include",
            body: JSON.stringify(recurrence ? {
              requestKey: recurrenceRequestKey.current,
              title: fields.title,
              startTime: fields.startsAt,
              childId: fields.childId,
              assigneeUserId: fields.assigneeUserId,
              reminderEnabled: fields.reminderEnabled,
              reminderLeadMinutes: fields.reminderLeadMinutes,
              recurrence,
            } : {
              ...fields,
              tags: [],
              category: detectPlanItemCategory(text.trim()),
            }),
          });
      if (editItem && response.status === 409) {
        // Заметку успели изменить — обновляем план и выходим, чтобы не повторять устаревшую версию.
        requestPlanRefetchForDate(editItem.date);
        toast.error("Заметка изменилась", { description: "Обновили план — попробуйте перенести ещё раз" });
        onBack();
        return;
      }
      if (!response.ok) throw new Error("save_failed");
      if (editItem) requestPlanRefetchForDate(editItem.date);
      requestPlanRefetchForDate(day);
      toast.success(
        `${isMove ? "Перенесли" : "Добавили"} на ${when === "other" ? longDay(day) : whenWord}`,
      );
      onSaved(day);
    } catch {
      toast.error(isMove ? "Не получилось перенести" : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  const barDay = day
    ? `${when === "today" ? "Сегодня" : when === "tomorrow" ? "Завтра" : weekdayLong(day)}, ${longDay(day)}`
    : "Выберите день";
  const chipBase = "mp-font-ui inline-flex h-[46px] shrink-0 items-center gap-2 rounded-full border px-[18px] text-[14px] font-semibold whitespace-nowrap transition-colors";
  const chipOn = "border-[var(--mp-chip-on-bg)] bg-[var(--mp-chip-on-bg)] text-[var(--mp-chip-on-tx)]";
  const chipOff = "border-[var(--mp-line-strong)] bg-white text-[var(--mp-tx)] enabled:hover:border-[var(--mp-tx2)]";
  const pickedChipLabel = pickedDate ? `${weekdayShort(pickedDate)}, ${longDay(pickedDate)}` : null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--mp-bg)]">
      <div className="flex shrink-0 items-center gap-3 px-5 pb-1 pt-[26px] md:px-8">
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад в план"
          className={cn("flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border border-[var(--mp-line)] bg-white text-[var(--mp-tx)] shadow-[0_4px_12px_-4px_rgba(20,18,16,.18)] transition-colors hover:bg-[var(--mp-bg)]", PLAN_FOCUS)}
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
        <p
          style={{ fontFamily: "Menlo, ui-monospace, SFMono-Regular, Monaco, Consolas, monospace" }}
          className="m-0 text-[10px] font-medium uppercase leading-none tracking-[.14em] text-[var(--mp-ac-dark)]"
        >
          {isMove ? "Перенести дело" : "Новое дело"}
        </p>
      </div>
      <div
        data-plan-new-task-scroll
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y px-5 pb-6 pt-0 md:px-8"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <label className="block">
          <span className="sr-only">Что нужно сделать</span>
          <textarea
            ref={textRef}
            rows={2}
            maxLength={160}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Что нужно сделать?"
            className="mp-font-ui m-0 mb-[18px] mt-3 block min-h-[76px] w-full resize-none border-0 bg-transparent p-0 !text-[26px] font-bold leading-[1.15] tracking-[-.01em] text-[var(--mp-tx)] caret-[var(--mp-ac)] outline-none placeholder:font-bold placeholder:text-[#b9b0a5]"
          />
        </label>

        <div className="mb-6">
          <div className={SECTION_LABEL}>Для кого</div>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] md:-mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
            {[{ id: "", name: "Вся семья", kind: "adult" as const }, ...people].map((p) => {
              const on = whoId === p.id;
              const colors = planParticipantPalette(p.id ? `${p.kind}:${p.id}` : null);
              return (
                <button
                  key={p.id || "family"}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setWhoId(p.id)}
                  className={cn(chipBase, p.id ? "pl-2" : "", on ? chipOn : chipOff, PLAN_FOCUS)}
                >
                  {p.id ? (
                    <span
                      aria-hidden
                      className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[11px] font-bold"
                      style={on ? { background: "rgba(255,255,255,.16)", color: "#fff" } : { background: colors.bg, color: colors.fg }}
                    >
                      {displayName(p).trim().charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <Users className="h-[18px] w-[18px]" aria-hidden />
                  )}
                  {displayName(p)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <div className={SECTION_LABEL}>Когда</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={when === "today"} onClick={() => { setWhen("today"); setCalOpen(false); }} className={cn(chipBase, when === "today" ? chipOn : chipOff, PLAN_FOCUS)}>
              Сегодня
            </button>
            <button type="button" aria-pressed={when === "tomorrow"} onClick={() => { setWhen("tomorrow"); setCalOpen(false); }} className={cn(chipBase, when === "tomorrow" ? chipOn : chipOff, PLAN_FOCUS)}>
              Завтра
            </button>
            {when === "other" && pickedChipLabel ? (
              <button type="button" aria-pressed onClick={() => setCalOpen(true)} className={cn(chipBase, chipOn, PLAN_FOCUS)}>
                {pickedChipLabel}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            aria-expanded={calOpen}
            onClick={() => {
              if (!calOpen && when !== "other") setWhen("other");
              setCalOpen((v) => !v);
            }}
            className={cn(
              "mt-3 flex min-h-[62px] w-full items-center gap-3 rounded-[20px] border-[1.5px] border-dashed py-0 pl-3.5 pr-[18px] text-left transition-colors hover:border-[var(--mp-tx2)] hover:bg-[var(--mp-card)]",
              calOpen ? "border-[var(--mp-tx2)] bg-[var(--mp-card)]" : "border-[var(--mp-line-strong)]",
              PLAN_FOCUS,
            )}
          >
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-[var(--mp-line-strong)] bg-white">
              {calOpen ? <X className="h-4 w-4" strokeWidth={2} aria-hidden /> : <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />}
            </span>
            <span className="flex-1 text-[15px] font-semibold text-[var(--mp-tx)]">{calOpen ? "Свернуть календарь" : "Другой день"}</span>
            <span className="mp-font-meta text-[11px] text-[var(--mp-tx2)]">весь календарь →</span>
          </button>
          {calOpen ? (
            <div className="mt-2.5 rounded-[20px] border border-[var(--mp-line)] bg-[var(--mp-card)] p-2.5">
              <div className="mb-1 flex items-center justify-between">
                <button type="button" aria-label="Предыдущий месяц" disabled={monthOffset <= 0} onClick={() => setMonthOffset((v) => v - 1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--mp-line-strong)] bg-white text-[var(--mp-tx)] disabled:opacity-30">
                  <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                </button>
                <span className="text-[18px] font-normal capitalize tracking-[-.01em] text-[var(--mp-tx)]">{monthLabel}</span>
                <button type="button" aria-label="Следующий месяц" onClick={() => setMonthOffset((v) => v + 1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--mp-line-strong)] bg-white text-[var(--mp-tx)]">
                  <ChevronRight className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {WD.map((w) => (
                  <span key={w} className="mp-font-meta py-1.5 text-center text-[10px] uppercase text-[var(--mp-tx2)]">{w}</span>
                ))}
                {cells.map((d, i) => {
                  if (d === null) return <span key={`b${i}`} />;
                  const value = iso(monthDate.getFullYear(), monthDate.getMonth(), d);
                  const disabled = value < todayIso;
                  const on = value === pickedDate && when === "other";
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={disabled}
                      onClick={() => { setPickedDate(value); setWhen("other"); setCalOpen(false); }}
                      className={cn(
                        "mp-font-display h-11 rounded-xl text-[17px] tabular-nums transition-colors disabled:text-[#c2b9ae]",
                        on ? "bg-[var(--mp-tx)] text-white" : "hover:enabled:bg-white",
                        value === todayIso && !on && "shadow-[inset_0_0_0_1.5px_var(--mp-tx)]",
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mb-6">
          <div className={SECTION_LABEL}>Время</div>
          <div className="flex gap-2">
            <button type="button" aria-pressed={!timed} onClick={() => setTimed(false)} className={cn(chipBase, "tabular-nums", !timed ? chipOn : chipOff, PLAN_FOCUS)}>
              Без времени
            </button>
            <label
              className={cn(
                "flex h-[46px] min-w-0 flex-1 cursor-text items-center gap-2.5 rounded-full border bg-white pl-3.5 pr-1.5 transition-colors focus-within:border-[var(--mp-tx)]",
                timed ? "border-[var(--mp-tx)] shadow-[inset_0_0_0_1px_var(--mp-tx)]" : "border-[var(--mp-line-strong)]",
              )}
              onClick={() => {
                enableTime();
                window.setTimeout(() => timeRef.current?.focus(), 0);
              }}
            >
              <Clock3 className={cn("h-[18px] w-[18px] shrink-0", timed ? "text-[var(--mp-tx)]" : "text-[var(--mp-tx2)]")} aria-hidden />
              <input
                ref={timeRef}
                inputMode="numeric"
                placeholder="чч:мм"
                value={time}
                onChange={(event) => {
                  setTime(maskTime(event.target.value));
                  enableTime();
                }}
                aria-label="Своё время"
                aria-invalid={timed && !timeValid}
                aria-describedby={timed && !timeValid ? "plan-time-error" : undefined}
                className={cn("mp-font-meta w-full min-w-0 border-0 bg-transparent p-0 pr-3 text-[16px] font-semibold text-[var(--mp-tx)] outline-none placeholder:font-normal placeholder:text-[#b9b0a5]", timed && !timeValid && "text-danger")}
              />
            </label>
          </div>
          {pastToday ? <p className="mx-0.5 mt-2.5 text-[13.5px] leading-[1.45] text-[var(--mp-tx2)]">Это время сегодня уже прошло — можно поставить на завтра</p> : null}
        </div>

        <div className="mb-[22px]">
          <div className={SECTION_LABEL}>Напомнить</div>
          <div className="flex flex-wrap gap-2">
            {REMIND_OPTIONS.map((o) => {
              const on = timed ? lead === o.minutes && !customActive : o.minutes === null;
              // Без времени доступно только «Не напоминать»; остальные явно выключены.
              const disabled = !timed && o.minutes !== null;
              return (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => {
                    setCustomLeadOpen(false);
                    setLead(o.minutes);
                    setLeadTouched(true);
                  }}
                  className={cn(PLAN_CHIP, on ? PLAN_CHIP_ON : PLAN_CHIP_OFF, PLAN_CHIP_DISABLED)}
                >
                  {o.minutes !== null ? <Bell className="h-4 w-4" aria-hidden /> : null}
                  {o.label}
                </button>
              );
            })}
            <button
              type="button"
              disabled={!timed}
              aria-expanded={customLeadOpen}
              aria-pressed={customActive}
              onClick={() => {
                if (customLeadOpen) {
                  setCustomLeadOpen(false);
                  return;
                }
                if (!customActive) {
                  // По умолчанию «за 30 минут», как в дизайне; дальше человек крутит колесо.
                  setCustomLeadUnit("minutes");
                  setCustomLeadValue("30");
                  setLead(30);
                  setLeadTouched(true);
                } else {
                  const unit = lead % 10080 === 0 ? "weeks" : lead % 1440 === 0 ? "days" : lead % 60 === 0 ? "hours" : "minutes";
                  setCustomLeadUnit(unit);
                  setCustomLeadValue(String(Math.min(LEAD_UNITS.find((u) => u.key === unit)!.max, lead / leadFactors[unit])));
                }
                setCustomLeadOpen(true);
              }}
              className={cn(PLAN_CHIP, customActive ? PLAN_CHIP_ON : PLAN_CHIP_OFF, PLAN_CHIP_DISABLED)}
            >
              <Bell className="h-4 w-4" aria-hidden />
              {customActive ? `За ${leadValue} ${leadPlural(leadValue, leadUnit.forms)}` : "Другое"}
            </button>
          </div>
          {customLeadOpen && timed ? (
            <div className="mt-2.5">
              <div className="relative grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-1 rounded-[20px] border border-[var(--mp-line)] bg-[var(--mp-card)] px-4">
                <span aria-hidden className="pointer-events-none absolute inset-x-2 top-1/2 -mt-5 h-10 rounded-xl bg-white shadow-[0_1px_3px_rgba(20,18,16,.08)]" />
                <Wheel
                  label="Сколько до начала"
                  items={Array.from({ length: leadUnit.max }, (_, i) => String(i + 1))}
                  value={leadValue - 1}
                  onChange={(index) => {
                    setCustomLeadValue(String(index + 1));
                    setLead((index + 1) * leadFactors[leadUnit.key]);
                    setLeadTouched(true);
                  }}
                  className="mp-font-meta pr-2.5 text-right"
                />
                <Wheel
                  label="Единица времени"
                  items={LEAD_UNITS.map((u) => leadPlural(leadValue, u.forms))}
                  value={LEAD_UNITS.findIndex((u) => u.key === leadUnit.key)}
                  onChange={(index) => {
                    const unit = LEAD_UNITS[index]!;
                    const next = Math.min(leadValue, unit.max);
                    setCustomLeadUnit(unit.key);
                    setCustomLeadValue(String(next));
                    setLead(next * leadFactors[unit.key]);
                    setLeadTouched(true);
                  }}
                  className="pl-1.5 text-left"
                />
                <span className="mp-font-meta relative text-[12.5px] text-[var(--mp-tx2)]">до начала</span>
              </div>
              <p className="mt-2 text-[12px] text-[var(--mp-tx2)]">В Telegram напоминание придёт, если бот подключён и уведомления включены.</p>
            </div>
          ) : null}
          {!timed ? <p className="mx-0.5 mt-2 text-[13px] text-[var(--mp-tx2)]">Укажите время, чтобы включить напоминание</p> : null}
        </div>
        {!isMove && (
          <div className="mb-[22px]">
            <div className={SECTION_LABEL}>Повторять</div>
            <div className="flex flex-wrap gap-2">
              {([
                ["NONE", "Никогда"],
                ["DAILY", "Каждый день"],
                ["WEEKLY", "Каждую неделю"],
                ["MONTHLY", "Каждый месяц"],
              ] as const).map(([value, name]) => (
                <button key={value} type="button" aria-pressed={repeat === value}
                  onClick={() => {
                    if (value === "WEEKLY" && day && !repeatDays.includes(weekdayOf(day))) setRepeatDays([weekdayOf(day)]);
                    setRepeat(value);
                  }}
                  className={cn(PLAN_CHIP, repeat === value ? PLAN_CHIP_ON : PLAN_CHIP_OFF)}>
                  {name}
                </button>
              ))}
            </div>
            {repeat === "WEEKLY" && (
              <>
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Дни недели">
                  {WD.map((name, index) => {
                    const value = index + 1;
                    const selected = repeatDays.includes(value);
                    return (
                      <button key={value} type="button" aria-pressed={selected}
                        onClick={() => setRepeatDays(days => selected ? days.filter(d => d !== value) : [...days, value])}
                        className={cn("h-11 min-w-11 rounded-full px-2 text-sm font-semibold", PLAN_FOCUS,
                          selected ? PLAN_CHIP_ON : PLAN_CHIP_OFF)}>{name}</button>
                    );
                  })}
                </div>
                {!repeatValid && <p role="alert" className="mt-2 text-sm text-danger">Выберите день начала и дни повторений.</p>}
              </>
            )}
            {repeat !== "NONE" && (
              <div className="mt-3 grid gap-2">
                <label className="grid gap-1.5 text-sm font-semibold">
                  Конец повтора (необязательно)
                  <input type="date" min={day ?? todayIso} value={repeatEnd === "UNTIL" ? repeatUntil : ""}
                    onChange={e => {
                      setRepeatUntil(e.target.value);
                      setRepeatEnd(e.target.value ? "UNTIL" : "NEVER");
                    }}
                    className="min-h-11 rounded-xl border border-[var(--mp-line)] bg-white px-3" />
                </label>
                {repeatEnd === "UNTIL" && timed && (
                  <label className="grid gap-1.5 text-sm font-semibold">
                    Время окончания (необязательно)
                    <input type="time" value={repeatUntilTime} onChange={e => setRepeatUntilTime(e.target.value)}
                      className="min-h-11 rounded-xl border border-[var(--mp-line)] bg-white px-3" />
                  </label>
                )}
                <p className="text-[12px] text-[var(--mp-tx2)]">Если дата не указана, задача будет повторяться без ограничения. Время окончания ограничивает последний день повторения.</p>
                {!repeatValid && repeatEnd === "UNTIL" && <p role="alert" className="text-sm text-danger">Конец повтора должен быть не раньше начала.</p>}
              </div>
            )}
          </div>
        )}

      </div>
      <div className="shrink-0 bg-[var(--mp-bg)] px-3.5 pb-[max(1.1rem,env(safe-area-inset-bottom))] pt-1">
        <div className="flex min-h-[62px] items-center gap-3 rounded-[20px] border border-[#f7d2c0] bg-[var(--mp-ac-soft)] py-2 pl-[18px] pr-2 text-[var(--mp-tx)]">
          <div className="min-w-0 flex-1">
            <b className="block text-[15px] font-semibold leading-[1.25] tracking-[-.01em] text-[var(--mp-tx)]">
              {barDay}
              {timed && timeValid ? ` в ${time}` : ""}
            </b>
            <span className="sr-only" role="status">{label}</span>
          </div>
          <button
            type="button"
            disabled={!can || saving}
            onClick={() => void submit()}
            className={cn("mp-font-ui h-11 shrink-0 rounded-[14px] bg-[var(--mp-ac)] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--mp-ac-dark)] disabled:bg-[#f2c4ac] disabled:text-white", PLAN_FOCUS)}
          >
            {saving ? "Сохраняем…" : isMove ? "Перенести" : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
}
