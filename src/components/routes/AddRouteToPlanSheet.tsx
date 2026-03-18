"use client";

import React, { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { CalendarCheck, CalendarDays, CalendarClock, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeTitle: string;
  routeSlug: string;
};

function getTodayISO() { return new Date().toISOString().split("T")[0]; }
function getTomorrowISO() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; }
function formatDateRu(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

type View = "quick" | "calendar";

function PlanContent({
  routeTitle,
  onClose,
}: {
  routeTitle: string;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>("quick");
  const [calValue, setCalValue] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async (dateISO: string) => {
    setSaving(true);
    try {
      // Integration point: POST /api/save/plan with routeId/routeSlug
      // For MVP — mock interaction with toast feedback
      await new Promise((r) => setTimeout(r, 400));
      toast.success("Маршрут добавлен в план", {
        description: `На ${formatDateRu(dateISO)}`,
        action: {
          label: "Открыть план",
          onClick: () => { window.location.href = "/me/plan"; },
        },
        duration: 4000,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (view === "calendar") {
    return (
      <div className="px-5 py-5 space-y-5">
        <button
          onClick={() => setView("quick")}
          className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />Назад
        </button>
        <div>
          <p className="text-sm font-semibold text-neutral-900">Выберите дату</p>
          <p className="text-xs text-neutral-500 mt-0.5">Маршрут будет добавлен в ваш план</p>
        </div>
        <input
          type="date"
          min={getTodayISO()}
          value={calValue}
          onChange={(e) => setCalValue(e.target.value)}
          className="w-full h-12 px-4 rounded-2xl border border-neutral-200 bg-white text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-400 transition-all cursor-pointer"
        />
        <div className="flex gap-2.5">
          <Button variant="outline" size="lg" className="flex-1 rounded-2xl border-neutral-200" onClick={() => setView("quick")}>
            Назад
          </Button>
          <Button
            size="lg"
            className="flex-1 rounded-2xl font-semibold"
            disabled={!calValue || saving}
            onClick={() => calValue && handleSave(calValue)}
          >
            Добавить в план
          </Button>
        </div>
      </div>
    );
  }

  const options = [
    {
      icon: <CalendarCheck className="w-5 h-5" />,
      title: "Сегодня",
      subtitle: `Добавить на ${formatDateRu(getTodayISO())}`,
      onClick: () => handleSave(getTodayISO()),
    },
    {
      icon: <CalendarDays className="w-5 h-5" />,
      title: "Завтра",
      subtitle: `Добавить на ${formatDateRu(getTomorrowISO())}`,
      onClick: () => handleSave(getTomorrowISO()),
    },
    {
      icon: <CalendarClock className="w-5 h-5" />,
      title: "Выбрать дату",
      subtitle: "Открыть календарь",
      onClick: () => setView("calendar"),
    },
  ];

  return (
    <div className="px-5 py-5 space-y-3">
      <div>
        <p className="text-sm font-semibold text-neutral-900">Добавить в план</p>
        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{routeTitle}</p>
      </div>
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.title}
            onClick={opt.onClick}
            disabled={saving}
            className={cn(
              "w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border border-neutral-200 bg-white text-left",
              "hover:border-neutral-300 hover:bg-neutral-50 active:scale-[0.985] transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20",
              "disabled:opacity-50"
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0">
              {opt.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900">{opt.title}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{opt.subtitle}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AddRouteToPlanSheet({ open, onOpenChange, routeTitle, routeSlug }: Props) {
  const isDesktop = useMediaQuery("(min-width: 640px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-3xl border-neutral-200">
          <DialogTitle className="sr-only">Добавить в план</DialogTitle>
          <div className="px-5 pt-5 pb-4 border-b border-neutral-100">
            <p className="text-[15px] font-semibold text-neutral-900 text-center">Добавить в план</p>
          </div>
          <PlanContent routeTitle={routeTitle} onClose={() => onOpenChange(false)} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="fixed inset-x-0 bottom-0 w-full rounded-t-3xl bg-white border-t border-neutral-100 shadow-2xl p-0 gap-0"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-neutral-200" />
        </div>
        <div className="px-5 pt-2 pb-4 border-b border-neutral-100">
          <p className="text-[15px] font-semibold text-neutral-900 text-center">Добавить в план</p>
        </div>
        <SheetTitle className="sr-only">Добавить в план</SheetTitle>
        <PlanContent routeTitle={routeTitle} onClose={() => onOpenChange(false)} />
        <div className="h-[env(safe-area-inset-bottom)]" />
      </SheetContent>
    </Sheet>
  );
}
