"use client";

import { useMemo, useRef, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, Check, Clock3, Mic, Users } from "lucide-react";
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
  PLAN_SEG,
  PLAN_SEG_BTN,
  PLAN_SEG_OFF,
  PLAN_SEG_ON,
} from "./planChipStyles";
import { PlanScreenTitleHead } from "./PlanScreenTitleHead";

export type PlanNewTaskPerson = { id: string; name: string; kind: "adult" | "child" };

/** Quick reminder presets; a custom offset supports up to 24 hours. */
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
  const [customLeadHours, setCustomLeadHours] = useState(initialCustomLead == null ? "" : String(Math.floor(initialCustomLead / 60)));
  const [customLeadMinutes, setCustomLeadMinutes] = useState(initialCustomLead == null ? "" : String(initialCustomLead % 60));
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
  const customLeadTotal = Number(customLeadHours || 0) * 60 + Number(customLeadMinutes || 0);
  const customLeadValid = !timed || !customLeadOpen || (
    /^\d{0,2}$/.test(customLeadHours) &&
    /^\d{0,2}$/.test(customLeadMinutes) &&
    Number(customLeadHours || 0) <= 24 &&
    Number(customLeadMinutes || 0) < 60 &&
    customLeadTotal >= 1 &&
    customLeadTotal <= 1440
  );
  const can = Boolean(text.trim() && day && (!timed || timeValid) && customLeadValid);
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
        : await fetch("/api/plan/manual", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--mp-bg)]">
      <PlanScreenTitleHead title={isMove ? <>Перенести <em>дело</em></> : <>Новое <em>дело</em></>} onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 md:px-8">
        <div className="mb-[22px] mt-1">
        <label className="block">
          <span className="sr-only">Что нужно сделать</span>
          <textarea
            autoFocus={!isMove}
            rows={2}
            maxLength={160}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Что нужно сделать?"
            className={cn(
              "mp-font-ui block w-full resize-none rounded-2xl border border-[var(--mp-chip-line)] bg-white px-4 py-3",
              "text-[20px] font-normal leading-[1.3] tracking-[-.01em] text-[var(--mp-tx)] caret-[var(--mp-ac)]",
              "outline-none transition-shadow placeholder:font-normal placeholder:text-[var(--text-muted)]",
              "focus:border-[var(--mp-tx)] focus:shadow-[0_0_0_3px_rgba(26,20,16,.08)]",
            )}
          />
        </label>
        <div className="mt-2 flex items-center gap-[7px] border-b border-[var(--mp-line)] pb-4 text-[13px] text-[var(--mp-tx2)] md:hidden">
          <Mic className="h-[15px] w-[15px]" aria-hidden />
          Удобнее голосом — нажмите микрофон на&nbsp;клавиатуре
        </div>
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
                        "h-11 rounded-xl text-[15px] font-bold tabular-nums transition-colors disabled:text-[var(--text-subtle)]",
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
                className="w-[72px] border-0 bg-transparent p-0 text-base font-extrabold tabular-nums tracking-[.02em] text-[var(--mp-tx)] outline-none placeholder:font-semibold placeholder:text-[var(--text-muted)]"
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
                  <span className={cn("relative flex h-[62px] w-[62px] items-center justify-center rounded-full border-2 text-[21px] font-extrabold transition-colors", "text-[var(--mp-ac)]", on ? "border-[var(--mp-ac)] bg-[var(--mp-soft)]" : "border-transparent bg-[var(--mp-soft)] hover:border-[var(--mp-line-strong)]")}>
                    {p.id === "" ? <Users className="h-6 w-6" aria-hidden /> : displayName(p).trim().charAt(0).toUpperCase()}
                    {on ? (
                      <span className="absolute -bottom-[3px] -right-[3px] flex h-[23px] w-[23px] items-center justify-center rounded-full border-2 border-[var(--mp-bg)] bg-[var(--mp-ac)] text-white">
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
          </div>
          <button
            type="button"
            disabled={!timed}
            aria-expanded={customLeadOpen}
            onClick={() => {
              if (customLeadOpen) {
                setCustomLeadOpen(false);
                return;
              }
              const initial = lead !== null && !REMIND_OPTIONS.some((option) => option.minutes === lead) ? lead : 0;
              setCustomLeadHours(initial ? String(Math.floor(initial / 60)) : "");
              setCustomLeadMinutes(initial ? String(initial % 60) : "");
              setCustomLeadOpen(true);
            }}
            className={cn("mt-2 inline-flex min-h-11 items-center rounded-full px-4", PLAN_CHIP, customLeadOpen ? PLAN_CHIP_ON : PLAN_CHIP_OFF, PLAN_CHIP_DISABLED)}
          >
            Своё время
          </button>
          {customLeadOpen && timed ? (
            <div className="mt-3 rounded-2xl border border-[var(--mp-line)] p-3">
              <p className="mb-2 text-[13px] text-[var(--mp-tx2)]">За сколько до начала напомнить (до 24 часов)</p>
              <div className="flex items-center gap-3">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                  Часы
                  <input
                    type="number"
                    min={0}
                    max={24}
                    inputMode="numeric"
                    value={customLeadHours}
                    onChange={(event) => {
                      const next = event.target.value;
                      setCustomLeadHours(next);
                      const total = Number(next || 0) * 60 + Number(customLeadMinutes || 0);
                      setLead(total > 0 && total <= 1440 ? total : null);
                      setLeadTouched(true);
                    }}
                    className="h-11 w-full rounded-xl border border-[var(--mp-line)] bg-white px-3 text-base"
                    aria-label="Часов до напоминания"
                  />
                </label>
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                  Минуты
                  <input
                    type="number"
                    min={0}
                    max={59}
                    inputMode="numeric"
                    value={customLeadMinutes}
                    onChange={(event) => {
                      const next = event.target.value;
                      setCustomLeadMinutes(next);
                      const total = Number(customLeadHours || 0) * 60 + Number(next || 0);
                      setLead(total > 0 && total <= 1440 ? total : null);
                      setLeadTouched(true);
                    }}
                    className="h-11 w-full rounded-xl border border-[var(--mp-line)] bg-white px-3 text-base"
                    aria-label="Минут до напоминания"
                  />
                </label>
              </div>
              {!customLeadValid ? <p role="alert" className="mt-2 text-[13px] text-danger">Укажите от 1 минуты до 24 часов</p> : null}
              <p className="mt-2 text-[12px] text-[var(--mp-tx2)]">В Telegram напоминание придёт, если бот подключён и уведомления включены.</p>
            </div>
          ) : null}
          {!timed ? <p className="mx-0.5 mt-2 text-[13px] text-[var(--mp-tx2)]">Укажите время, чтобы включить напоминание</p> : null}
        </div>
      </div>
      <div className="shrink-0 border-t border-[var(--mp-line)] bg-[var(--mp-bg)] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:px-8">
        <button
          type="button"
          disabled={!can || saving}
          onClick={() => void submit()}
          className={cn("mp-font-ui flex h-[54px] w-full items-center justify-center rounded-2xl bg-[var(--mp-ac)] text-base font-bold text-white transition-colors hover:bg-[var(--mp-ac-dark)] disabled:bg-[var(--border)] disabled:text-[var(--text-muted)]", PLAN_FOCUS)}
        >
          {saving ? "Сохраняем…" : label}
        </button>
      </div>
    </div>
  );
}
