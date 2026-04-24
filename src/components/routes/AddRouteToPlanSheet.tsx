"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { CalendarCheck, CalendarDays, CalendarClock, Bookmark, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { DatePicker } from "@/components/ui/date-picker";
import { useSaveRouteOnboarding } from "@/hooks/useSaveRouteOnboarding";
import { SaveRouteOnboarding } from "@/components/onboarding/SaveRouteOnboarding";
import { useRouter } from "next/navigation";
import {
  addDaysLocal,
  formatLocalPlanDate,
  getLocalDateKey,
} from "@/lib/date/localDateKey";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeTitle: string;
  routeSlug: string;
  routeId: string;
  coverImageUrl?: string;
  /** false для демо-маршрутов без записи в БД — скрывает «Сохранить в идеи» */
  allowSaveToIdeas?: boolean;
  isAuthenticated: boolean;
};

type View = "quick" | "datepicker";

function PlanContent({
  open,
  routeTitle,
  routeId,
  routeSlug,
  coverImageUrl,
  allowSaveToIdeas,
  isAuthenticated,
  onClose,
}: {
  open: boolean;
  routeTitle: string;
  routeId: string;
  routeSlug: string;
  coverImageUrl?: string;
  allowSaveToIdeas: boolean;
  isAuthenticated: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("quick");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    showOnboarding,
    pendingParams,
    initiateSave,
    closeOnboarding,
    handleSaveComplete,
  } = useSaveRouteOnboarding({
    sourceContext: "route_add_to_plan_sheet",
    onSaveComplete: (result) => {
      // Show success toast
      if (result.savedTo === "plan" && result.date) {
        toast.success("Маршрут добавлен в план", {
          description: `Сохранено на ${formatLocalPlanDate(result.date, "ru-RU")}`,
          action: {
            label: "Открыть план",
            onClick: () => router.push("/?myPlan=open"),
          },
          duration: 4000,
        });
      } else {
        toast.success("Маршрут сохранён в идеи", {
          description: "Вы сможете вернуться к нему позже",
          action: {
            label: "Открыть идеи",
            onClick: () => router.push("/me/ideas"),
          },
          duration: 4000,
        });
      }
      onClose();
    },
  });

  const handleSave = useCallback(async (dateISO?: string) => {
    setSaving(true);
    
    try {
      await initiateSave(
        {
          routeId,
          routeSlug,
          routeTitle,
          coverImageUrl,
          allowSaveToIdeas,
          selectedDate: dateISO,
        },
        isAuthenticated
      );
      
      // If authenticated, save was completed directly and toast shown
      if (isAuthenticated) {
        onClose();
      }
      // If not authenticated, onboarding modal will open
    } catch (error) {
      console.error("Failed to save route:", error);
      toast.error("Не удалось сохранить маршрут", {
        description: "Попробуйте ещё раз",
      });
    } finally {
      setSaving(false);
    }
  }, [routeId, routeSlug, routeTitle, coverImageUrl, allowSaveToIdeas, isAuthenticated, initiateSave, onClose]);

  const handleDatePickerConfirm = useCallback(() => {
    if (!selectedDate) return;
    
    const dateISO = getLocalDateKey(selectedDate);
    handleSave(dateISO);
  }, [selectedDate, handleSave]);

  useEffect(() => {
    if (!open) {
      setView("quick");
      setSelectedDate(null);
    }
  }, [open]);

  if (view === "datepicker") {
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
        
        <DatePicker
          value={selectedDate}
          onDateChange={setSelectedDate}
          disablePast={true}
          placeholder="Выберите дату"
        />
        
        <div className="flex gap-2.5">
          <Button 
            variant="outline" 
            size="lg" 
            className="flex-1 rounded-2xl border-neutral-200" 
            onClick={() => setView("quick")}
            disabled={saving}
          >
            Назад
          </Button>
          <Button
            size="lg"
            className="flex-1 rounded-2xl font-semibold"
            disabled={!selectedDate || saving}
            onClick={handleDatePickerConfirm}
          >
            Добавить в план
          </Button>
        </div>
      </div>
    );
  }

  const todayISO = getLocalDateKey();
  const tomorrowISO = addDaysLocal(todayISO, 1);
  const options = [
    {
      icon: <CalendarCheck className="w-5 h-5" />,
      title: "Сегодня",
      subtitle: `Добавить на ${formatLocalPlanDate(todayISO, "ru-RU")}`,
      onClick: () => handleSave(todayISO),
      iconBg: "bg-neutral-900",
      iconColor: "text-white",
    },
    {
      icon: <CalendarDays className="w-5 h-5" />,
      title: "Завтра",
      subtitle: `Добавить на ${formatLocalPlanDate(tomorrowISO, "ru-RU")}`,
      onClick: () => handleSave(tomorrowISO),
      iconBg: "bg-neutral-900",
      iconColor: "text-white",
    },
    {
      icon: <CalendarClock className="w-5 h-5" />,
      title: "Выбрать дату",
      subtitle: "Открыть календарь",
      onClick: () => setView("datepicker"),
      iconBg: "bg-neutral-900",
      iconColor: "text-white",
    },
    ...(allowSaveToIdeas
      ? [
          {
            icon: <Bookmark className="w-5 h-5" />,
            title: "Сохранить в идеи",
            subtitle: "Вернуться к этому позже",
            onClick: () => handleSave(undefined),
            iconBg: "bg-neutral-100",
            iconColor: "text-neutral-600",
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="px-5 py-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Куда сохранить маршрут?</p>
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
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                opt.iconBg,
                opt.iconColor
              )}>
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
      
      {showOnboarding && pendingParams && (
        <SaveRouteOnboarding
          open={showOnboarding}
          onOpenChange={closeOnboarding}
          routeId={pendingParams.routeId}
          routeSlug={pendingParams.routeSlug}
          routeTitle={pendingParams.routeTitle}
          sourceContext="route_add_to_plan_sheet"
          onSaveComplete={handleSaveComplete}
        />
      )}
    </>
  );
}

export function AddRouteToPlanSheet({
  open,
  onOpenChange,
  routeTitle,
  routeSlug,
  routeId,
  coverImageUrl,
  allowSaveToIdeas = true,
  isAuthenticated,
}: Props) {
  const isDesktop = useMediaQuery("(min-width: 640px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-3xl border-neutral-200">
          <DialogTitle className="sr-only">Сохранить маршрут</DialogTitle>
          <div className="px-5 pt-5 pb-4 border-b border-neutral-100">
            <p className="text-[15px] font-semibold text-neutral-900 text-center">Сохранить маршрут</p>
          </div>
          <PlanContent 
            open={open}
            routeTitle={routeTitle} 
            routeId={routeId}
            routeSlug={routeSlug}
            coverImageUrl={coverImageUrl}
            allowSaveToIdeas={allowSaveToIdeas}
            isAuthenticated={isAuthenticated}
            onClose={() => onOpenChange(false)} 
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="fixed inset-x-0 bottom-0 w-full max-h-[90vh] rounded-t-3xl bg-white border-t border-neutral-100 shadow-2xl p-0 gap-0 overflow-y-auto"
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-neutral-200" />
        </div>
        <div className="px-5 pt-2 pb-4 border-b border-neutral-100 shrink-0">
          <p className="text-[15px] font-semibold text-neutral-900 text-center">Сохранить маршрут</p>
        </div>
        <SheetTitle className="sr-only">Сохранить маршрут</SheetTitle>
        <PlanContent 
          open={open}
          routeTitle={routeTitle} 
          routeId={routeId}
          routeSlug={routeSlug}
          coverImageUrl={coverImageUrl}
          allowSaveToIdeas={allowSaveToIdeas}
          isAuthenticated={isAuthenticated}
          onClose={() => onOpenChange(false)} 
        />
        <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
      </SheetContent>
    </Sheet>
  );
}
