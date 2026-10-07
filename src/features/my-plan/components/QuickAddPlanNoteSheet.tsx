"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, Clock3, Gift, GraduationCap, MapPin, Plus, UserRound, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { requestPlanRefetchForDate } from "@/lib/my-plan/myPlanOpenIntent";
import { toast } from "@/lib/toast";

type ChildOption = { id: string; name: string };

export function QuickAddPlanNoteSheet({
  open,
  onOpenChange,
  selectedDate,
  childrenList,
  city,
  onRequestClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  childrenList: ChildOption[];
  city: string;
  onRequestClose?: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(selectedDate);
  const [time, setTime] = useState("");
  const [childId, setChildId] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const childLabel = useMemo(
    () => childrenList.find((child) => child.id === childId)?.name ?? "Для кого",
    [childId, childrenList],
  );
  const dateLabel = new Date(date + "T12:00:00")
    .toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
    .replace(".", "");

  useEffect(() => {
    if (!open) setDate(selectedDate);
  }, [open, selectedDate]);

  function reset() {
    setTitle("");
    setDate(selectedDate);
    setTime("");
    setChildId("");
    setReminderEnabled(false);
    setTags([]);
    setTagDraft("");
    setError("");
  }

  function commitTag() {
    const tag = tagDraft.trim().replace(/^#+/, "").trim();
    if (!tag || tag.length > 32) return;
    setTags((current) =>
      current.length >= 12 ||
      current.some((item) => item.toLocaleLowerCase("ru-RU") === tag.toLocaleLowerCase("ru-RU"))
        ? current
        : [...current, tag],
    );
    setTagDraft("");
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

  function navigate(href: string) {
    onOpenChange(false);
    onRequestClose?.();
    window.setTimeout(() => router.push(href), 0);
  }

  const chip =
    "inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium text-[#302B27]";
  const sections = [
    ["Куда пойти", "Афиша, события и места", `/${city}/kuda`, MapPin],
    ["Занятия", "Кружки, секции, курсы", `/${city}/classes`, GraduationCap],
    ["Праздники", "Организация дня рождения", `/${city}/birthday`, Gift],
  ] as const;

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
        className="max-h-[92dvh] overflow-y-auto rounded-t-[30px] bg-[#FFFEFC] p-0"
      >
        <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-neutral-300" />
        <SheetHeader className="flex-row items-center justify-between px-5 py-4 text-left">
          <div>
            <SheetTitle className="text-[28px] font-semibold tracking-[-.03em] text-[#141210]">
              Добавить в план
            </SheetTitle>
            <SheetDescription className="sr-only">
              Добавить заметку в семейный план
            </SheetDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Закрыть"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200"
          >
            <X className="h-5 w-5" />
          </button>
        </SheetHeader>

        <div className="space-y-5 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <textarea
            autoFocus
            rows={3}
            maxLength={160}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Что нужно сделать или не забыть?"
            className="w-full resize-none rounded-[22px] border border-neutral-200 bg-white px-4 py-4 text-[17px] leading-6 outline-none focus:border-primary/60"
          />

          <div className="flex flex-wrap gap-2">
            <label className={chip + " border-[#F2D6C8] bg-[#FFF2EC] text-[#C9572B]"}>
              <CalendarDays className="h-4 w-4" />
              <span>{dateLabel}</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="sr-only" />
            </label>
            <label className={chip}>
              <Clock3 className="h-4 w-4" />
              <span>{time || "Время"}</span>
              <input
                type="time"
                value={time}
                onChange={(event) => {
                  setTime(event.target.value);
                  if (!event.target.value) setReminderEnabled(false);
                }}
                className="sr-only"
              />
            </label>
            <label className={chip}>
              <UserRound className="h-4 w-4" />
              <span>{childLabel}</span>
              <select value={childId} onChange={(event) => setChildId(event.target.value)} className="sr-only">
                <option value="">Я / Семья</option>
                {childrenList.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              aria-pressed={reminderEnabled}
              onClick={() => setReminderEnabled((value) => !value)}
              disabled={!time}
              className={
                chip +
                (reminderEnabled ? " border-[#F2D6C8] bg-[#FFF2EC] text-[#C9572B]" : "") +
                " disabled:opacity-40"
              }
            >
              <Bell className="h-4 w-4" />
              Напомнить
            </button>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-500">Теги</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTags((items) => items.filter((item) => item !== tag))}
                  className="h-10 rounded-full bg-[#FFF2EC] px-3 text-sm text-[#C9572B]"
                >
                  #{tag}
                </button>
              ))}
              <label className="flex h-10 min-w-[105px] items-center gap-1 rounded-full border border-dashed border-neutral-300 px-3">
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
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
            </div>
          </div>

          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}

          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="min-h-14 w-full rounded-[18px] bg-primary font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>

          <div className="border-t border-neutral-200 pt-5">
            <p className="mb-3 text-sm font-medium text-neutral-500">Или перейти в раздел</p>
            <div className="space-y-2">
              {sections.map(([name, subtitle, href, Icon]) => (
                <button
                  key={href}
                  type="button"
                  onClick={() => navigate(href)}
                  className="flex w-full items-center gap-3 rounded-[18px] border border-neutral-200 bg-white p-3 text-left"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF2EC] text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <b className="block">{name}</b>
                    <span className="text-sm text-neutral-500">{subtitle}</span>
                  </span>
                  <span className="text-xl text-neutral-400">›</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
