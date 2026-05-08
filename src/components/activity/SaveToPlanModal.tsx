"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { toast } from "@/lib/toast";
import {
  CalendarDays, CalendarCheck, CalendarClock,
  Bookmark, BookmarkCheck, ChevronRight, ChevronLeft,
  ExternalLink, Pencil, Trash2,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import {
  addDaysLocal,
  formatLocalPlanDate,
  getLocalDateKey,
} from "@/lib/date/localDateKey";

export type SaveScenario =
  | { kind: "confirm"; title: string; dateLabel: string; timeLabel: string; dateISO: string; slotId?: string | null }
  | { kind: "timeslots"; title: string; dateLabel: string; dateISO: string; slots: { id: string; label: string }[] }
  | {
      kind: "quickdate";
      title: string;
      /** Одна дата сеанса (страница события): «В план» = на эту дату или в идеи, без «сегодня/завтра». */
      eventPlanDateISO?: string;
      /** Набор доступных дат события (YYYY-MM-DD). */
      eventPlanDateOptions?: string[];
    };

export type SaveToPlanResult =
  | { action: "plan"; dateISO: string; timeSlotId?: string | null }
  | { action: "ideas" }
  | { action: "remove-idea" }
  | { action: "cancel" };

export interface SaveToPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario: SaveScenario;
  onConfirm: (result: SaveToPlanResult) => void;
  isIdea?: boolean;
  inPlan?: boolean;
  planDate?: string | null;
  planStartsAt?: string | null;
}

type ModalView = "quick" | "calendar";

function toastPlan(dateISO: string) {
  toast.success("Добавлено в план", {
    description: `Активность сохранена на ${formatLocalPlanDate(dateISO, "ru-RU")}`,
    action: { label: "Открыть план", onClick: () => { window.location.href = "/me/plan"; } },
    duration: 4000,
  });
}
function toastIdea() {
  toast.success("Сохранено в идеи", {
    description: "Вы сможете вернуться к этому позже",
    action: { label: "Открыть идеи", onClick: () => { window.location.href = "/me/ideas"; } },
    duration: 4000,
  });
}
function toastRemovedIdea() { toast("Убрано из идей", { duration: 2500 }); }

interface ActionRowProps {
  icon: React.ReactNode; title: string; subtitle: string; onClick: () => void;
  iconBg?: string; iconColor?: string; rightEl?: React.ReactNode;
}
function ActionRow({ icon, title, subtitle, onClick, iconBg = "bg-neutral-900", iconColor = "text-white", rightEl }: ActionRowProps) {
  return (
    <button onClick={onClick} className={cn(
      "w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border border-neutral-200 bg-white text-left",
      "hover:border-neutral-300 hover:bg-neutral-50 active:scale-[0.985] transition-all duration-100",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
    )}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconBg, iconColor)}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-900 leading-tight">{title}</p>
        <p className="text-xs text-neutral-500 mt-0.5 leading-tight">{subtitle}</p>
      </div>
      {rightEl ?? <ChevronRight className="w-4 h-4 text-neutral-300 shrink-0" />}
    </button>
  );
}

interface StatusAction { label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean; }
interface StatusCardProps { icon: React.ReactNode; title: string; subtitle: string; actions: StatusAction[]; }
function StatusCard({ icon, title, subtitle, actions }: StatusCardProps) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-green-100 text-green-600 flex items-center justify-center shrink-0 mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 leading-tight">{title}</p>
          <p className="text-xs text-neutral-500 mt-0.5 leading-snug">{subtitle}</p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {actions.map((a, i) => (
          <button key={i} onClick={a.onClick} className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors",
            a.danger ? "text-red-500 hover:bg-red-50" : "bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-300"
          )}>{a.icon}{a.label}</button>
        ))}
      </div>
    </div>
  );
}

function CalendarView({
  onBack,
  onSelect,
  allowedDateKeys,
}: {
  onBack: () => void;
  onSelect: (iso: string) => void;
  allowedDateKeys?: string[] | null;
}) {
  const [value, setValue] = React.useState<Date | null>(null);
  const handleConfirm = () => {
    if (!value) return;
    const iso = getLocalDateKey(value);
    onSelect(iso);
  };
  return (
    <div className="space-y-4 px-4 py-4">
      <DatePicker
        value={value}
        onDateChange={setValue}
        disablePast
        allowedDateKeys={allowedDateKeys}
      />
      <Button size="lg" className="w-full rounded-2xl font-semibold" disabled={!value} onClick={handleConfirm}>
        Сохранить в план
      </Button>
    </div>
  );
}

function formatEventSessionPlanSubtitle(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function normalizePlanDateISO(value?: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return getLocalDateKey(parsed);
}

interface QuickViewProps {
  isIdea: boolean;
  inPlan: boolean;
  planDate: string | null;
  planStartsAt: string | null;
  /** YYYY-MM-DD единственного сеанса — только «на дату проведения», без сегодня/завтра. */
  eventPlanDateISO?: string | null;
  /** Доступные даты события (YYYY-MM-DD). Для multi-date сценария. */
  eventPlanDateOptions?: string[];
  onPlan: (iso: string) => void;
  onIdea: () => void;
  onRemoveIdea: () => void;
  onSwitchCalendar: () => void;
}
function QuickView({
  isIdea,
  inPlan,
  planDate,
  planStartsAt: _planStartsAt,
  eventPlanDateISO,
  eventPlanDateOptions,
  onPlan,
  onIdea,
  onRemoveIdea,
  onSwitchCalendar,
}: QuickViewProps) {
  const todayISO = getLocalDateKey();
  const tomorrowISO = addDaysLocal(todayISO, 1);
  const normalizedOptions = React.useMemo(() => {
    const unique = new Set((eventPlanDateOptions ?? []).map((d) => normalizePlanDateISO(d)).filter(Boolean));
    return Array.from(unique).sort() as string[];
  }, [eventPlanDateOptions]);
  const upcomingOptions = normalizedOptions.filter((d) => d >= todayISO);
  const nearestTwo = upcomingOptions.slice(0, 2);
  const isSingleEventDate = Boolean(eventPlanDateISO);
  const hasMultiEventDates = !isSingleEventDate && upcomingOptions.length > 0;

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest px-1">В план</p>
        {inPlan && planDate ? (
          <StatusCard
            icon={<CalendarCheck className="w-4 h-4" />}
            title={`Уже в плане на ${formatLocalPlanDate(planDate, "ru-RU")}`}
            subtitle="Вы можете изменить дату или открыть план"
            actions={[
              { label: "Изменить дату", icon: <Pencil className="w-3 h-3" />, onClick: onSwitchCalendar },
              { label: "Открыть план", icon: <ExternalLink className="w-3 h-3" />, onClick: () => { window.location.href = "/me/plan"; } },
            ]}
          />
        ) : isSingleEventDate ? (
          <ActionRow
            icon={<CalendarCheck className="w-5 h-5" />}
            title="На дату проведения"
            subtitle={`Добавить в план на ${formatEventSessionPlanSubtitle(eventPlanDateISO ?? "")}`}
            onClick={() => onPlan(eventPlanDateISO ?? "")}
          />
        ) : hasMultiEventDates ? (
          <>
            {nearestTwo.map((iso, index) => (
              <ActionRow
                key={iso}
                icon={<CalendarCheck className="w-5 h-5" />}
                title={index === 0 ? "Ближайшая дата" : "Следующая дата"}
                subtitle={`Добавить в план на ${formatEventSessionPlanSubtitle(iso)}`}
                onClick={() => onPlan(iso)}
              />
            ))}
            {upcomingOptions.length > 2 ? (
              <ActionRow
                icon={<CalendarClock className="w-5 h-5" />}
                title="Выбрать дату"
                subtitle="Показать все даты из расписания"
                onClick={onSwitchCalendar}
              />
            ) : null}
          </>
        ) : (
          <>
            <ActionRow icon={<CalendarCheck className="w-5 h-5" />} title="Сегодня" subtitle={`Добавить в план на ${formatLocalPlanDate(todayISO, "ru-RU")}`} onClick={() => onPlan(todayISO)} />
            <ActionRow icon={<CalendarDays className="w-5 h-5" />} title="Завтра" subtitle={`Добавить в план на ${formatLocalPlanDate(tomorrowISO, "ru-RU")}`} onClick={() => onPlan(tomorrowISO)} />
            <ActionRow icon={<CalendarClock className="w-5 h-5" />} title="Выбрать дату" subtitle="Открыть календарь и выбрать день" onClick={onSwitchCalendar} />
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-neutral-100" /><span className="text-[11px] text-neutral-400">или</span><div className="flex-1 h-px bg-neutral-100" />
      </div>
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest px-1">Без даты</p>
        {isIdea ? (
          <StatusCard
            icon={<BookmarkCheck className="w-4 h-4" />}
            title="Уже в идеях"
            subtitle="Событие сохранено и доступно в вашем списке"
            actions={[
              { label: "Открыть идеи", icon: <ExternalLink className="w-3 h-3" />, onClick: () => { window.location.href = "/me/ideas"; } },
              { label: "Убрать из идей", icon: <Trash2 className="w-3 h-3" />, onClick: onRemoveIdea, danger: true },
            ]}
          />
        ) : (
          <ActionRow icon={<Bookmark className="w-5 h-5" />} title="Сохранить в идеи" subtitle="Вернуться к этому позже" onClick={onIdea} iconBg="bg-neutral-100" iconColor="text-neutral-600" />
        )}
      </div>
    </div>
  );
}

/** Только выбор (план / идеи / слоты) — без тостов и без закрытия. Для SaveActivityFlow и кастомных сценариев. */
export interface SaveToPlanPickerBodyProps {
  scenario: SaveScenario;
  onCommit: (result: SaveToPlanResult) => void;
  isIdea?: boolean;
  inPlan?: boolean;
  planDate?: string | null;
  planStartsAt?: string | null;
}

export function SaveToPlanPickerBody({
  scenario,
  onCommit,
  isIdea = false,
  inPlan = false,
  planDate = null,
  planStartsAt = null,
}: SaveToPlanPickerBodyProps) {
  const [view, setView] = React.useState<ModalView>("quick");
  const [selectedSlotId, setSelectedSlotId] = React.useState<string | null>(
    scenario.kind === "timeslots" && scenario.slots.length > 0 ? scenario.slots[0].id : null
  );

  const handlePlan = (iso: string) => {
    onCommit({ action: "plan", dateISO: iso, timeSlotId: null });
  };
  const handleIdea = () => {
    onCommit({ action: "ideas" });
  };
  const handleRemoveIdea = () => {
    onCommit({ action: "remove-idea" });
  };
  const handleConfirmPlan = () => {
    if (scenario.kind === "confirm") {
      onCommit({
        action: "plan",
        dateISO: scenario.dateISO,
        timeSlotId: scenario.slotId ?? null,
      });
    } else if (scenario.kind === "timeslots") {
      onCommit({
        action: "plan",
        dateISO: scenario.dateISO,
        timeSlotId: selectedSlotId,
      });
    }
  };

  const isQuickdate = scenario.kind === "quickdate";
  const eventPlanDateISO = normalizePlanDateISO(
    scenario.kind === "quickdate" ? scenario.eventPlanDateISO ?? null : null,
  );
  const eventPlanDateOptions =
    scenario.kind === "quickdate" ? scenario.eventPlanDateOptions ?? [] : [];
  const headerTitle =
    view === "calendar"
      ? "Выберите дату"
      : isQuickdate
        ? "Куда сохранить активность?"
        : scenario.kind === "timeslots"
          ? "Выберите время"
          : "Добавить в план?";
  const headerSubtitle =
    view === "calendar"
      ? "Активность будет добавлена в ваш план"
      : isQuickdate
        ? eventPlanDateISO
          ? "На дату проведения или сохраните в идеи"
          : "Выберите дату для плана или сохраните в идеи"
        : null;

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5 pb-4 border-b border-neutral-100">
        <p className="text-[18px] font-semibold text-neutral-900 text-center leading-snug">{headerTitle}</p>
        {headerSubtitle && <p className="text-xs text-neutral-500 text-center mt-1 leading-snug">{headerSubtitle}</p>}
      </div>
      {isQuickdate ? (
        view === "calendar" ? (
          <CalendarView
            onBack={() => setView("quick")}
            onSelect={(iso) => {
              setView("quick");
              handlePlan(iso);
            }}
            allowedDateKeys={eventPlanDateOptions}
          />
        ) : (
          <QuickView
            isIdea={isIdea}
            inPlan={inPlan}
            planDate={planDate}
            planStartsAt={planStartsAt}
            eventPlanDateISO={eventPlanDateISO}
            eventPlanDateOptions={eventPlanDateOptions}
            onPlan={handlePlan}
            onIdea={handleIdea}
            onRemoveIdea={handleRemoveIdea}
            onSwitchCalendar={() => setView("calendar")}
          />
        )
      ) : (
        <>
          <div className="px-4 py-4">
            {scenario.kind === "confirm" ? (
              <div className="rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3.5">
                <p className="text-sm font-semibold text-neutral-900">{scenario.title}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{scenario.dateLabel} · {scenario.timeLabel}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                  <p className="text-sm font-semibold text-neutral-900">{scenario.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{scenario.dateLabel}</p>
                </div>
                {scenario.slots.map((slot) => (
                  <button key={slot.id} onClick={() => setSelectedSlotId(slot.id)} className={cn(
                    "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left",
                    selectedSlotId === slot.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white hover:border-neutral-300 text-neutral-900"
                  )}>
                    <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0", selectedSlotId === slot.id ? "border-white" : "border-neutral-400")}>
                      {selectedSlotId === slot.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm font-medium">{slot.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="px-4 pb-5 pt-3 flex gap-2.5 border-t border-neutral-100">
            <Button variant="outline" size="lg" className="flex-1 rounded-2xl font-semibold border-neutral-200" onClick={handleIdea}>
              {isIdea ? "Уже в идеях" : "В идеи"}
            </Button>
            <Button size="lg" className="flex-1 rounded-2xl font-semibold" onClick={handleConfirmPlan} disabled={!!inPlan}>
              {inPlan && planDate ? `На ${formatLocalPlanDate(planDate, "ru-RU")}` : "Добавить в план"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

interface ModalContentProps extends SaveToPlanModalProps {
  onClose: () => void;
}
function ModalContent(props: ModalContentProps) {
  const { onConfirm, onClose, scenario, isIdea, inPlan, planDate, planStartsAt } =
    props;
  return (
    <SaveToPlanPickerBody
      scenario={scenario}
      isIdea={isIdea}
      inPlan={inPlan}
      planDate={planDate}
      planStartsAt={planStartsAt}
      onCommit={(result) => {
        if (result.action === "plan") {
          toastPlan(result.dateISO);
        } else if (result.action === "ideas") {
          toastIdea();
        } else if (result.action === "remove-idea") {
          toastRemovedIdea();
        }
        onConfirm(result);
        onClose();
      }}
    />
  );
}

export function SaveToPlanModal(props: SaveToPlanModalProps) {
  const { open, onOpenChange } = props;
  const isDesktop = useMediaQuery("(min-width: 640px)");
  // `mounted` prevents rendering either container during SSR / hydration,
  // so we never mount Sheet and Dialog simultaneously.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-3xl border-neutral-200">
          <DialogTitle className="sr-only">Сохранить активность</DialogTitle>
          <ModalContent {...props} onClose={() => onOpenChange(false)} />
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false}
        className="fixed inset-x-0 bottom-0 w-full max-h-[90vh] rounded-t-3xl bg-white border-t border-neutral-100 shadow-2xl p-0 flex flex-col overflow-hidden gap-0">
        <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 rounded-full bg-neutral-200" /></div>
        <SheetTitle className="sr-only">Сохранить активность</SheetTitle>
        <div className="flex-1 overflow-y-auto"><ModalContent {...props} onClose={() => onOpenChange(false)} /></div>
        <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
      </SheetContent>
    </Sheet>
  );
}
