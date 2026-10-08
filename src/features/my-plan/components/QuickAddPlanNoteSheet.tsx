"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, ChevronRight, Clock3, Plus, Search, UserRound, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { requestPlanRefetchForDate } from "@/lib/my-plan/myPlanOpenIntent";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { detectPlanItemCategory, type PlanItemCategoryKey } from "../lib/planItemCategory";
import { PlanItemCategoryPicker } from "./PlanItemCategoryIcon";

type ChildOption = { id: string; name: string };

const CHIP_BASE =
  "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium outline-none transition-colors " +
  "focus-within:ring-[3px] focus-within:ring-ring/50";
const CHIP_FILLED = "border border-transparent bg-brand-soft text-brand-active";
const CHIP_EMPTY = "border border-dashed border-border-strong bg-white text-text-muted";

function formatDateChip(iso: string): string {
  const label = new Date(`${iso}T12:00:00`)
    .toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })
    .replace(/\./g, "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function QuickAddPlanNoteSheet({
  open,
  onOpenChange,
  onNavigateCatalog,
  selectedDate,
  childrenList,
  city,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateCatalog: () => void;
  selectedDate: string;
  childrenList: ChildOption[];
  city: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(selectedDate);
  const [time, setTime] = useState("");
  const [childId, setChildId] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  // Ручной выбор категории не перезаписывается автоопределением при правке названия.
  const [manualCategory, setManualCategory] = useState<PlanItemCategoryKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const category = manualCategory ?? detectPlanItemCategory(title);
  const child = useMemo(() => childrenList.find((c) => c.id === childId) ?? null, [childId, childrenList]);

  useEffect(() => {
    if (!open) setDate(selectedDate);
  }, [open, selectedDate]);

  // Поле ввода сразу в фокусе (после того, как Radix сфокусирует первый элемент шторки).
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  function reset() {
    setTitle("");
    setDate(selectedDate);
    setTime("");
    setChildId("");
    setReminderEnabled(false);
    setTags([]);
    setTagDraft("");
    setManualCategory(null);
    setError("");
  }

  function commitTag() {
    const tag = tagDraft.trim().replace(/^#+/, "").trim();
    const key = tag.toLocaleLowerCase("ru-RU");
    setTagDraft("");
    if (!tag || tag.length > 32) return;
    // Человек задаётся только через «Для кого»: теги с именами людей не создаём.
    if (childrenList.some((c) => c.name.trim().toLocaleLowerCase("ru-RU") === key)) {
      setError("Для имени используйте «Для кого» — теги только по смыслу, например #школа");
      return;
    }
    setError("");
    setTags((current) =>
      current.length >= 12 || current.some((item) => item.toLocaleLowerCase("ru-RU") === key)
        ? current
        : [...current, tag],
    );
  }

  async function save() {
    if (!title.trim()) {
      setError("Напишите, что нужно добавить в план");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/plan/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          date,
          startsAt: time || null,
          childId: childId || null,
          tags,
          category,
          reminderEnabled: reminderEnabled && Boolean(time),
        }),
      });
      if (!response.ok) throw new Error("save_failed");
      requestPlanRefetchForDate(date);
      toast.success("Добавлено в план");
      onOpenChange(false);
      reset();
    } catch {
      setError("Не удалось сохранить заметку");
    } finally {
      setSaving(false);
    }
  }

  function closeDraft() {
    onOpenChange(false);
    reset();
  }

  function openCatalog() {
    const qp = new URLSearchParams({
      from: date,
      to: date,
      date,
      children: "all",
      planMode: "1",
      planDate: date,
      returnTo: window.location.pathname + window.location.search,
    });
    onNavigateCatalog();
    reset();
    window.setTimeout(() => router.push(`/${city}/events?${qp.toString()}`), 0);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92dvh] overflow-y-auto rounded-t-[30px] bg-surface p-0"
      >
        <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-border-strong" />
        <SheetHeader className="flex-row items-center justify-between px-5 py-3 text-left">
          <div>
            <SheetTitle className="text-[26px] font-semibold tracking-[-.03em] text-text-main">
              Добавить в план
            </SheetTitle>
            <SheetDescription className="sr-only">Добавить заметку в семейный план</SheetDescription>
          </div>
          <button
            type="button"
            onClick={closeDraft}
            aria-label="Закрыть"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border"
          >
            <X className="h-5 w-5" />
          </button>
        </SheetHeader>

        <div className="space-y-4 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-start gap-3">
            <PlanItemCategoryPicker value={category} onChange={setManualCategory} className="mt-0.5" />
            <textarea
              ref={inputRef}
              autoFocus
              rows={1}
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Что нужно сделать или не забыть?"
              className={cn(
                "field-sizing-content max-h-[4.5rem] min-h-11 w-full resize-none rounded-2xl border border-border bg-white px-4 py-2.5",
                "text-[16px] leading-6 outline-none focus:border-brand",
              )}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <label className={cn(CHIP_BASE, CHIP_FILLED)}>
              <CalendarDays className="h-4 w-4" />
              <span>{formatDateChip(date)}</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="sr-only" />
            </label>

            <label className={cn(CHIP_BASE, time ? CHIP_FILLED : CHIP_EMPTY)}>
              <Clock3 className="h-4 w-4" />
              <span>{time || "Весь день"}</span>
              <input
                type="time"
                value={time}
                onChange={(event) => {
                  setTime(event.target.value);
                  if (!event.target.value) setReminderEnabled(false);
                }}
                className="sr-only"
                aria-label="Время"
              />
            </label>

            <label className={cn(CHIP_BASE, child ? CHIP_FILLED : CHIP_EMPTY)}>
              {child ? (
                <span
                  aria-hidden
                  className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand text-[10px] font-medium text-white"
                >
                  {child.name.trim().charAt(0).toUpperCase()}
                </span>
              ) : (
                <UserRound className="h-4 w-4" />
              )}
              <span>{child ? child.name : "Для кого"}</span>
              <select
                value={childId}
                onChange={(event) => setChildId(event.target.value)}
                className="sr-only"
                aria-label="Для кого"
              >
                <option value="">Вся семья</option>
                {childrenList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              aria-pressed={reminderEnabled}
              onClick={() => setReminderEnabled((value) => !value)}
              disabled={!time}
              className={cn(CHIP_BASE, reminderEnabled && time ? CHIP_FILLED : CHIP_EMPTY, "disabled:opacity-40")}
            >
              <Bell className="h-4 w-4" />
              {reminderEnabled && time ? "Напоминание включено" : "Напомнить"}
            </button>

            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-label={`Убрать тег ${tag}`}
                onClick={() => setTags((items) => items.filter((item) => item !== tag))}
                className={cn(CHIP_BASE, CHIP_FILLED)}
              >
                #{tag}
              </button>
            ))}
            <label className={cn(CHIP_BASE, CHIP_EMPTY, "min-w-[104px] gap-1")}>
              <Plus className="h-4 w-4" />
              <input
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onBlur={commitTag}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    commitTag();
                  }
                }}
                placeholder="тег"
                aria-label="Смысловой тег, например школа"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
          </div>

          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}

          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="min-h-14 w-full rounded-[18px] bg-brand font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>

          <button
            type="button"
            onClick={openCatalog}
            className="flex w-full items-center gap-3 rounded-[18px] border border-border bg-white p-3 text-left"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <Search className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block">Найти в mamaGo</b>
              <span className="block truncate text-sm text-text-muted">Афиша · занятия · праздники</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-text-subtle" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
