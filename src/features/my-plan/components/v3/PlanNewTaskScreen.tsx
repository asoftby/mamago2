"use client";

import { useMemo, useRef, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, Check, Clock3, Mic, Users } from "lucide-react";
import { requestPlanRefetchForDate } from "@/lib/my-plan/myPlanOpenIntent";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { detectPlanItemCategory } from "../../lib/planItemCategory";
import { PlanScreenHead } from "./PlanScreenHead";
import {
  PLAN_CHIP,
  PLAN_CHIP_DISABLED,
  PLAN_CHIP_OFF,
  PLAN_CHIP_ON,
  PLAN_FOCUS,
  PLAN_SEG,
  PLAN_SEG_BTN,
  PLAN_SEG_OFF,
  PLAN_SEG_ON,
} from "./planChipStyles";

export type PlanNewTaskPerson = { id: string; name: string; kind: "adult" | "child" };

/** «За сколько напомнить» — значения совпадают с REMINDER_LEAD_MINUTES_OPTIONS на сервере. */
const REMIND_OPTIONS: Array<{ minutes: number | null; label: string }> = [
  { minutes: null, label: "Не напоминать" },
  { minutes: 15, label: "За 15 минут" },
  { minutes: 60, label: "За час" },
  { minutes: 120, label: "За 2 часа" },
];

const WD = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function addDays(dateIso: string, n: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d! + n);
  return iso(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
function maskTime(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}
function longDay(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

const SECTION_LABEL = "mp-font-ui mb-[9px] text-[15px] font-bold text-[var(--mp-tx)]";

/**
 * «Новое дело» в той же шторке: текст → когда → время → для кого → напомнить.
 * Сохраняет через существующий POST /api/plan/manual (без разбора текста и тегов).
 */
export function PlanNewTaskScreen({
  todayIso,
  initialDate,
  people,
  onBack,
  onSaved,
}: {
  todayIso: string;
  initialDate: string;
  people: PlanNewTaskPerson[];
  onBack: () => void;
  onSaved: (date: string) => void;
}) {
  const tomorrowIso = useMemo(() => addDays(todayIso, 1), [todayIso]);
  /** Взрослый в профиле выводится как «Я» (как в «Мой план»), а не логином; остальные — по имени. */
  const firstAdultId = useMemo(() => people.find((p) => p.kind === "adult")?.id ?? null, [people]);
  const initialWhen = initialDate === todayIso ? "today" : initialDate === tomorrowIso ? "tomorrow" : "other";
  const [text, setText] = useState("");
  const [when, setWhen] = useState<"today" | "tomorrow" | "other">(initialWhen);
  const [pickedDate, setPickedDate] = useState<string | null>(initialWhen === "other" ? initialDate : null);
  const [timed, setTimed] = useState(false);
  const [time, setTime] = useState("");
  /** "" = вся семья; иначе id персоны (ребёнок → childId, взрослый → assigneeUserId). */
  const [whoId, setWhoId] = useState<string>("");
  const [lead, setLead] = useState<number | null>(null);
  const [leadTouched, setLeadTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const timeRef = useRef<HTMLInputElement>(null);

  const [ty, tm] = todayIso.split("-").map(Number);
  const [monthOffset, setMonthOffset] = useState(0);
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
  const can = Boolean(text.trim() && day && (!timed || timeValid));
  const whenWord = when === "today" ? "сегодня" : when === "tomorrow" ? "завтра" : day ? longDay(day) : "";
  const label = !text.trim()
    ? "Напишите, что нужно сделать"
    : !day
      ? "Выберите день"
      : timed && !timeValid
        ? "Укажите время"
        : "Добавить в план";

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
      const response = await fetch("/api/plan/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: text.trim(),
          date: day,
          startsAt: timed ? time : null,
          childId: who?.kind === "child" ? who.id : null,
          assigneeUserId: who?.kind === "adult" ? who.id : null,
          tags: [],
          category: detectPlanItemCategory(text.trim()),
          reminderEnabled: timed && lead !== null,
          reminderLeadMinutes: timed ? lead : null,
        }),
      });
      if (!response.ok) throw new Error("save_failed");
      requestPlanRefetchForDate(day);
      toast.success(`Добавили на ${when === "other" ? longDay(day) : whenWord}`);
      onSaved(day);
    } catch {
      toast.error("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--mp-bg)]">
      <PlanScreenHead back="План" onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 md:px-8">
        <h2 className="mp-font-display mb-3 mt-1 text-[28px] font-normal leading-[1.1] tracking-[-.02em] text-[var(--mp-tx)]">
          Новое{" "}
          <em className="font-medium italic text-[var(--mp-ac)]">дело</em>
        </h2>
        <label className="block">
          <span className="sr-only">Что нужно сделать</span>
          <textarea
            autoFocus
            rows={2}
            maxLength={160}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Что нужно сделать?"
            className={cn(
              "mp-font-ui block w-full resize-none rounded-2xl border border-[var(--mp-chip-line)] bg-white px-4 py-3",
              "text-[20px] font-semibold leading-[1.3] tracking-[-.01em] text-[var(--mp-tx)] caret-[var(--mp-ac)]",
              "outline-none transition-shadow placeholder:font-medium placeholder:text-[#6B665F]",
              "focus:border-[var(--mp-tx)] focus:shadow-[0_0_0_3px_rgba(29,27,25,.08)]",
            )}
          />
        </label>
        <div className="mb-[18px] mt-2 flex items-center gap-[7px] border-b border-[var(--mp-line)] pb-4 text-[13px] text-[var(--mp-tx2)] md:hidden">
          <Mic className="h-[15px] w-[15px]" aria-hidden />
          Удобнее голосом — нажмите микрофон на&nbsp;клавиатуре
        </div>

        <div className="mb-[22px]">
          <div className={SECTION_LABEL}>Когда</div>
          <div className={PLAN_SEG}>
            {([["today", "Сегодня"], ["tomorrow", "Завтра"], ["other", "Другой день"]] as const).map(([key, name]) => (
              <button
                key={key}
                type="button"
                aria-pressed={when === key}
                onClick={() => setWhen(key)}
                className={cn(PLAN_SEG_BTN, when === key ? PLAN_SEG_ON : PLAN_SEG_OFF)}
              >
                {name}
              </button>
            ))}
          </div>
          {when === "other" ? (
            <div className="mt-2.5 rounded-2xl border border-[var(--mp-line)] bg-[var(--mp-card)] px-2.5 py-3">
              <div className="mx-1 mb-1.5 flex items-center justify-between">
                <span className="text-[15px] font-bold capitalize text-[var(--mp-tx)]">{monthLabel}</span>
                <span className="flex">
                  <button type="button" aria-label="Предыдущий месяц" disabled={monthOffset <= 0} onClick={() => setMonthOffset((v) => v - 1)} className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--mp-tx2)] disabled:opacity-30">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button type="button" aria-label="Следующий месяц" onClick={() => setMonthOffset((v) => v + 1)} className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--mp-tx2)]">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </span>
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {WD.map((w) => (
                  <span key={w} className="py-1 text-center text-xs font-semibold text-[var(--mp-tx2)]">{w}</span>
                ))}
                {cells.map((d, i) => {
                  if (d === null) return <span key={`b${i}`} />;
                  const value = iso(monthDate.getFullYear(), monthDate.getMonth(), d);
                  const disabled = value < todayIso;
                  const on = value === pickedDate;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={disabled}
                      onClick={() => setPickedDate(value)}
                      className={cn(
                        "h-11 rounded-xl text-[15px] font-bold tabular-nums transition-colors disabled:text-[#B5ADA5]",
                        on ? "bg-[var(--mp-tx)] text-white" : "hover:enabled:bg-[var(--mp-soft)]",
                        !on && !disabled && i % 7 > 4 && "text-[var(--mp-ac-dark)]",
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

        <div className="mb-[22px]">
          <div className={SECTION_LABEL}>Время</div>
          <div className={PLAN_SEG}>
            <button
              type="button"
              aria-pressed={!timed}
              onClick={() => setTimed(false)}
              className={cn(PLAN_SEG_BTN, !timed ? PLAN_SEG_ON : PLAN_SEG_OFF)}
            >
              Без времени
            </button>
            <label
              className={cn(PLAN_SEG_BTN, "flex cursor-text items-center justify-center gap-[7px] px-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--mp-ac)]", timed ? PLAN_SEG_ON : PLAN_SEG_OFF)}
              onClick={() => {
                enableTime();
                window.setTimeout(() => timeRef.current?.focus(), 0);
              }}
            >
              <Clock3 className={cn("h-4 w-4", timed ? "text-[var(--mp-ac)]" : "text-[var(--mp-tx2)]")} aria-hidden />
              <input
                ref={timeRef}
                inputMode="numeric"
                placeholder="чч:мм"
                value={time}
                onChange={(event) => {
                  setTime(maskTime(event.target.value));
                  enableTime();
                }}
                className="w-[72px] border-0 bg-transparent p-0 text-base font-extrabold tabular-nums tracking-[.02em] text-[var(--mp-tx)] outline-none placeholder:font-semibold placeholder:text-[#6F6A65]"
              />
            </label>
          </div>
          {pastToday ? <p className="mx-0.5 mt-2 text-[13px] text-[var(--mp-tx2)]">Это время сегодня уже прошло — можно поставить на завтра</p> : null}
        </div>

        <div className="mb-[22px]">
          <div className={SECTION_LABEL}>Для кого</div>
          <div className="flex flex-wrap gap-5">
            {[{ id: "", name: "Вся семья", kind: "adult" as const }, ...people].map((p) => {
              const on = whoId === p.id;
              return (
                <button key={p.id || "family"} type="button" aria-pressed={on} onClick={() => setWhoId(p.id)} className={cn("flex min-w-11 flex-col items-center gap-[7px] rounded-2xl", PLAN_FOCUS)}>
                  <span className={cn("relative flex h-[62px] w-[62px] items-center justify-center rounded-full border-2 text-[21px] font-extrabold transition-colors", on ? "border-[var(--mp-tx)] bg-white" : "border-transparent bg-[var(--mp-soft)] hover:border-[var(--mp-line-strong)]")}>
                    {p.id === "" ? <Users className="h-6 w-6" aria-hidden /> : displayName(p).trim().charAt(0).toUpperCase()}
                    {on ? (
                      <span className="absolute -bottom-[3px] -right-[3px] flex h-[23px] w-[23px] items-center justify-center rounded-full border-2 border-[var(--mp-bg)] bg-[var(--mp-tx)] text-white">
                        <Check className="h-3 w-3" strokeWidth={2.8} aria-hidden />
                      </span>
                    ) : null}
                  </span>
                  <span className="mp-font-ui max-w-[72px] truncate text-sm font-semibold text-[var(--mp-tx)]">{displayName(p)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-[22px]">
          <div className={SECTION_LABEL}>Когда напомнить?</div>
          <div className="flex flex-wrap gap-2">
            {REMIND_OPTIONS.map((o) => {
              const on = timed ? lead === o.minutes : o.minutes === null;
              // Без времени доступно только «Не напоминать»; остальные явно выключены.
              const disabled = !timed && o.minutes !== null;
              return (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => {
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
          </div>
          {!timed ? <p className="mx-0.5 mt-2 text-[13px] text-[var(--mp-tx2)]">Укажите время, чтобы включить напоминание</p> : null}
        </div>
      </div>
      <div className="shrink-0 border-t border-[var(--mp-line)] bg-[var(--mp-bg)] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:px-8">
        <button
          type="button"
          disabled={!can || saving}
          onClick={() => void submit()}
          className={cn("mp-font-ui flex h-[54px] w-full items-center justify-center rounded-2xl bg-[var(--mp-ac)] text-base font-bold text-white transition-colors hover:bg-[var(--mp-ac-dark)] disabled:bg-[#E6E0D9] disabled:text-[#5F5A55]", PLAN_FOCUS)}
        >
          {saving ? "Сохраняем…" : label}
        </button>
      </div>
    </div>
  );
}
