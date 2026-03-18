"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { toast } from "sonner";
import {
  CalendarDays, CalendarCheck, CalendarClock,
  Bookmark, BookmarkCheck, ChevronRight, ChevronLeft,
  ExternalLink, Pencil, Trash2,
} from "lucide-react";

export type SaveScenario =
  | { kind: "confirm"; title: string; dateLabel: string; timeLabel: string; dateISO: string; slotId?: string | null }
  | { kind: "timeslots"; title: string; dateLabel: string; dateISO: string; slots: { id: string; label: string }[] }
  | { kind: "quickdate"; title: string };

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

function getTodayISO() { return new Date().toISOString().split("T")[0]; }
function getTomorrowISO() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; }
function formatDateRu(iso: string) { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }); }

function toastPlan(dateISO: string) {
  toast.success("Добавлено в план", {
    description: `Активность сохранена на ${formatDateRu(dateISO)}`,
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

function CalendarView({ onBack, onSelect }: { onBack: () => void; onSelect: (iso: string) => void }) {
  const [value, setValue] = React.useState("");
  return (
    <div className="space-y-5 px-4 py-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
        <ChevronLeft className="w-4 h-4" />Назад
      </button>
      <div>
        <p className="text-sm font-semibold text-neutral-900">Выберите дату</p>
        <p className="text-xs text-neutral-500 mt-0.5">Активность будет добавлена в ваш план</p>
      </div>
      <input type="date" min={getTodayISO()} value={value} onChange={(e) => setValue(e.target.value)}
        className="w-full h-12 px-4 rounded-2xl border border-neutral-200 bg-white text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-400 transition-all cursor-pointer" />
      <div className="flex gap-2.5">
        <Button variant="outline" size="lg" className="flex-1 rounded-2xl border-neutral-200" onClick={onBack}>Назад</Button>
        <Button size="lg" className="flex-1 rounded-2xl font-semibold" disabled={!value} onClick={() => value && onSelect(value)}>Сохранить в план</Button>
      </div>
    </div>
  );
}

interface QuickViewProps {
  isIdea: boolean; inPlan: boolean; planDate: string | null; planStartsAt: string | null;
  onPlan: (iso: string) => void; onIdea: () => void; onRemoveIdea: () => void; onSwitchCalendar: () => void;
}
function QuickView({ isIdea, inPlan, planDate, onPlan, onIdea, onRemoveIdea, onSwitchCalendar }: QuickViewProps) {
  const todayISO = getTodayISO();
  const tomorrowISO = getTomorrowISO();
  return (
    <div className="px-4 py-4 space-y-4">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest px-1">В план</p>
        {inPlan && planDate ? (
          <StatusCard
            icon={<CalendarCheck className="w-4 h-4" />}
            title={`Уже в плане на ${formatDateRu(planDate)}`}
            subtitle="Вы можете изменить дату или открыть план"
            actions={[
              { label: "Изменить дату", icon: <Pencil className="w-3 h-3" />, onClick: onSwitchCalendar },
              { label: "Открыть план", icon: <ExternalLink className="w-3 h-3" />, onClick: () => { window.location.href = "/me/plan"; } },
            ]}
          />
        ) : (
          <>
            <ActionRow icon={<CalendarCheck className="w-5 h-5" />} title="Сегодня" subtitle={`Добавить в план на ${formatDateRu(todayISO)}`} onClick={() => onPlan(todayISO)} />
            <ActionRow icon={<CalendarDays className="w-5 h-5" />} title="Завтра" subtitle={`Добавить в план на ${formatDateRu(tomorrowISO)}`} onClick={() => onPlan(tomorrowISO)} />
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

interface ModalContentProps extends SaveToPlanModalProps { onClose: () => void; }
function ModalContent({ scenario, onConfirm, onClose, isIdea = false, inPlan = false, planDate = null, planStartsAt = null }: ModalContentProps) {
  const [view, setView] = React.useState<ModalView>("quick");
  const [selectedSlotId, setSelectedSlotId] = React.useState<string | null>(
    scenario.kind === "timeslots" && scenario.slots.length > 0 ? scenario.slots[0].id : null
  );

  const handlePlan = (iso: string) => { onConfirm({ action: "plan", dateISO: iso, timeSlotId: null }); toastPlan(iso); onClose(); };
  const handleIdea = () => { onConfirm({ action: "ideas" }); toastIdea(); onClose(); };
  const handleRemoveIdea = () => { onConfirm({ action: "remove-idea" }); toastRemovedIdea(); onClose(); };
  const handleConfirmPlan = () => {
    if (scenario.kind === "confirm") { onConfirm({ action: "plan", dateISO: scenario.dateISO, timeSlotId: scenario.slotId ?? null }); toastPlan(scenario.dateISO); }
    else if (scenario.kind === "timeslots") { onConfirm({ action: "plan", dateISO: scenario.dateISO, timeSlotId: selectedSlotId }); toastPlan(scenario.dateISO); }
    onClose();
  };

  const isQuickdate = scenario.kind === "quickdate";
  const headerTitle = view === "calendar" ? "Выберите дату" : isQuickdate ? "Куда сохранить активность?" : scenario.kind === "timeslots" ? "Выберите время" : "Добавить в план?";
  const headerSubtitle = view === "calendar" ? "Активность будет добавлена в ваш план" : isQuickdate ? "Выберите дату для плана или сохраните в идеи" : null;

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5 pb-4 border-b border-neutral-100">
        <p className="text-[15px] font-semibold text-neutral-900 text-center leading-snug">{headerTitle}</p>
        {headerSubtitle && <p className="text-xs text-neutral-500 text-center mt-1 leading-snug">{headerSubtitle}</p>}
      </div>
      {isQuickdate ? (
        view === "calendar" ? (
          <CalendarView onBack={() => setView("quick")} onSelect={(iso) => { setView("quick"); handlePlan(iso); }} />
        ) : (
          <QuickView isIdea={isIdea} inPlan={inPlan} planDate={planDate} planStartsAt={planStartsAt}
            onPlan={handlePlan} onIdea={handleIdea} onRemoveIdea={handleRemoveIdea} onSwitchCalendar={() => setView("calendar")} />
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
              {inPlan && planDate ? `На ${formatDateRu(planDate)}` : "Добавить в план"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function SaveToPlanModal(props: SaveToPlanModalProps) {
  const { open, onOpenChange } = props;
  const isDesktop = useMediaQuery("(min-width: 640px)");
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
