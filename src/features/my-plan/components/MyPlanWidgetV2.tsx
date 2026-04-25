"use client";

import { useMemo, useState, useEffect, lazy, Suspense } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { addDays, format, isBefore, isSameDay, isToday, isTomorrow, startOfDay, startOfWeek } from "date-fns";
import { ru } from "date-fns/locale";
import { HeroMoodIcon } from "@/features/hero-weather";
import { useMyPlan } from "../hooks/useMyPlan";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlanAudienceCompact } from "./PlanAudienceCompact";
import { WeatherDisplay } from "./WeatherDisplay";
import { AddPersonaTypeModal } from "./AddPersonaTypeModal";
import { QuickAddChildModal } from "@/components/children/QuickAddChildModal";
import { QuickAddAdultModal } from "@/components/adults/QuickAddAdultModal";
import { toast } from "@/lib/toast";

interface MyPlanWidgetV2Props {
  onOpen: () => void;
  mode?: "floating" | "overlay";
}

type PlanState = "empty" | "recommendations" | "filled";

export function MyPlanWidgetV2({ onOpen, mode = "floating" }: MyPlanWidgetV2Props) {
  const { todayCount, todayItems, planSuggestions, suggestionsLoading, refetchPlanSuggestions, isLoading: planLoading } = useMyPlan();
  // Используем данные из useMyPlan вместо отдельного useAuthMe — избегаем дублирующего fetch
  const family = useFamilyPersona();
  const familyLoading = family?.loading ?? false;
  
  // Use family personas from context
  const selectedPersonaIds = family?.selectedPersonaIds ?? [];
  const allPersonas = family?.personas ?? [];
  
  // Determine audience mode
  const audienceMode = selectedPersonaIds.length === 0 ? "free" : "specific";
  
  // Handlers for persona selection
  const handleTogglePersona = (personaId: string) => {
    if (!family?.setSelectedPersonaIds) return;
    
    const isCurrentlySelected = selectedPersonaIds.includes(personaId);
    
    if (isCurrentlySelected) {
      // Remove persona
      const newSelection = selectedPersonaIds.filter(id => id !== personaId);
      family.setSelectedPersonaIds(newSelection);
    } else {
      // Add persona
      family.setSelectedPersonaIds([...selectedPersonaIds, personaId]);
    }
  };
  
  const handleToggleFreeMode = () => {
    if (!family?.setSelectedPersonaIds) return;
    // Clear all selections to enter free mode
    family.setSelectedPersonaIds([]);
  };
  
  const handleAddPersona = () => {
    setShowAddPersonaTypeModal(true);
  };

  const handleGenerateRecommendations = async () => {
    await refetchPlanSuggestions();
  };

  // Mock weather data - TODO: integrate real weather API
  const weather = { temp: "+12°", condition: "облачно", hint: "хорошая погода для спокойных мест" };

  const planState: PlanState = useMemo(() => {
    if (todayCount === 0 && planSuggestions.length > 0) return "recommendations";
    if (todayCount === 0) return "empty";
    return "filled";
  }, [todayCount, planSuggestions.length]);

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddPersonaTypeModal, setShowAddPersonaTypeModal] = useState(false);
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [showAddAdultModal, setShowAddAdultModal] = useState(false);

  const selectedDateLabel = useMemo(() => {
    if (isToday(selectedDate)) {
      return format(selectedDate, "Сегодня, d MMMM", { locale: ru });
    }

    if (isTomorrow(selectedDate)) {
      return format(selectedDate, "Завтра, d MMMM", { locale: ru });
    }

    const weekdayLabel = format(selectedDate, "EEEE, d MMMM", { locale: ru });
    return weekdayLabel.charAt(0).toUpperCase() + weekdayLabel.slice(1);
  }, [selectedDate]);

  const weekDates = useMemo(() => {
    const baseStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const currentWeekStart = addDays(baseStart, weekOffset * 7);
    return Array.from({ length: 7 }, (_, index) => addDays(currentWeekStart, index));
  }, [weekOffset]);
  
  // Sync selectedDate with weekDates when returning to current week
  useEffect(() => {
    // Find matching date in weekDates by comparing date strings
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    const matchingDate = weekDates.find(d => format(d, 'yyyy-MM-dd') === selectedDateStr);
    
    if (matchingDate && matchingDate !== selectedDate) {
      // Update to the new Date object from weekDates
      setSelectedDate(matchingDate);
    }
  }, [weekDates, selectedDate]);
  
  const weekMonthLabel = useMemo(() => {
    const monthNames = Array.from(
      new Set(weekDates.map((date) => format(date, "LLLL", { locale: ru }).toUpperCase())),
    );
    return monthNames.join(" - ");
  }, [weekDates]);
  const weekDayShort = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] as const;

  // Build personas list from family context
  const personas = useMemo(() =>
    allPersonas.map((p) => ({
      id: p.id,
      name: p.displayName,
      initial: p.displayName.charAt(0).toUpperCase(),
    })),
    [allPersonas]
  );

  const todayStart = useMemo(() => startOfDay(new Date()), []);

  if (planLoading || familyLoading) {
    return mode === "floating" ? null : (
      <div className={cn(
        "relative flex flex-col max-h-[85vh] rounded-[28px] border border-neutral-100 bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)]",
        "w-[min(100vw-2rem,400px)] max-w-[min(100vw-2rem,400px)] mx-auto",
      )}>
        <div className="p-5 pb-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[14px] bg-neutral-100 animate-pulse" />
            <div className="h-6 w-32 rounded-lg bg-neutral-100 animate-pulse" />
          </div>
          <div className="h-10 rounded-xl bg-neutral-100 animate-pulse" />
          <div className="h-16 rounded-xl bg-neutral-100 animate-pulse" />
          <div className="h-12 rounded-xl bg-neutral-100 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
        className={cn(
          "w-[min(100vw-2rem,400px)] max-w-[min(100vw-2rem,400px)] animate-in fade-in",
          mode === "floating"
            ? "fixed bottom-4 right-4 z-50 hidden lg:block slide-in-from-bottom-4 cursor-pointer"
            : "relative mx-auto h-full w-full max-w-none slide-in-from-top-2 cursor-default",
        )}
      >
        <div
          className={cn(
            "relative flex flex-col",
            mode === "floating"
              ? "max-h-[600px] rounded-[24px] border border-white/45 bg-white/55 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_18px_44px_rgba(17,24,39,0.2)] hover:-translate-y-1 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_22px_52px_rgba(17,24,39,0.24)]"
              : "max-h-[85vh] rounded-[28px] border border-neutral-100 bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)]",
          )}
        >
        {/* Header */}
        <div className="flex-shrink-0 p-5 pb-4 space-y-4">
          {/* Title & Date */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#EF8759]/10">
              <CalendarDays className="h-5 w-5 text-[#EF8759]" strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-neutral-900">Мой план</h2>
            </div>
          </div>

          {mode === "overlay" ? (
            <div className="relative rounded-xl border border-neutral-200 bg-white p-2">
              <div className="mb-2 flex items-center justify-center">
                <p className="text-xs font-medium text-neutral-600">{weekMonthLabel}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setWeekOffset((prev) => prev - 1);
                }}
                className="absolute left-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-white text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                aria-label="Предыдущая неделя"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setWeekOffset((prev) => prev + 1);
                }}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-white text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                aria-label="Следующая неделя"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="grid grid-cols-7 gap-1.5 px-10">
                {weekDates.map((date) => {
                  const active = isSameDay(date, selectedDate);
                  const isPastDate = isBefore(date, todayStart) && !isToday(date);
                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      aria-disabled={isPastDate}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDate(date);
                      }}
                      className={cn(
                        "rounded-lg px-1 py-1.5 text-center transition-colors",
                        active
                          ? "border border-[#ffb38a] bg-[linear-gradient(180deg,_#ffb185_0%,_#ff8f61_100%)] text-white shadow-[0_8px_16px_rgba(255,146,93,0.3),inset_0_1px_0_rgba(255,255,255,0.4)]"
                          : isPastDate
                            ? "text-neutral-300"
                            : "text-neutral-700 hover:bg-neutral-100",
                      )}
                    >
                      <span className={cn("block text-[10px] uppercase", active ? "text-white/85" : "text-neutral-400")}>
                        {weekDayShort[date.getDay()]}
                      </span>
                      <span className="block text-xs font-semibold">{format(date, "d")}</span>
                      {isToday(date) ? (
                        <span className={cn("block text-[10px]", active ? "text-white/85" : "text-[#EF8759]")}>
                          Сегодня
                        </span>
                      ) : (
                        <span className="block text-[10px] opacity-0">.</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Weather */}
          <WeatherDisplay date={selectedDate} timeOfDay="evening" />

          {/* Persona Selection */}
          <PlanAudienceCompact
            selectedPersonaIds={selectedPersonaIds}
            personas={allPersonas}
            audienceMode={audienceMode}
            onTogglePersona={handleTogglePersona}
            onToggleFreeMode={handleToggleFreeMode}
            onAddClick={handleAddPersona}
          />
        </div>

          {/* Content based on state */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            {planState === "empty" && (
              <EmptyPlanContent
                onOpen={onOpen}
                onGenerate={handleGenerateRecommendations}
                isGenerating={suggestionsLoading}
              />
            )}
            {planState === "recommendations" && (
              <RecommendationsContent
                recommendations={planSuggestions.slice(0, 3)}
                selectedPersonas={personas.filter(p => selectedPersonaIds.includes(p.id))}
              />
            )}
            {planState === "filled" && (
              <FilledPlanContent
                events={todayItems.map(item => ({
                  ...item,
                  startsAt: item.startsAt instanceof Date ? item.startsAt.toISOString() : item.startsAt,
                }))}
                selectedPersonas={personas.filter(p => selectedPersonaIds.includes(p.id))}
              />
            )}
          </div>
        </div>
      </div>
      {showAddPersonaTypeModal && (
        <AddPersonaTypeModal
          open={showAddPersonaTypeModal}
          onOpenChange={setShowAddPersonaTypeModal}
          onSelectChild={() => setShowAddChildModal(true)}
          onSelectAdult={() => setShowAddAdultModal(true)}
          layout={mode === "overlay" ? "desktop" : "default"}
        />
      )}
      {showAddChildModal && (
        <QuickAddChildModal
          open={showAddChildModal}
          onOpenChange={setShowAddChildModal}
          onSuccess={() => {
            toast.success("Ребёнок добавлен");
          }}
        />
      )}
      {showAddAdultModal && (
        <QuickAddAdultModal
          open={showAddAdultModal}
          onOpenChange={setShowAddAdultModal}
          onSuccess={() => {
            toast.success("Взрослый добавлен");
          }}
        />
      )}
    </>
  );
}

function EmptyPlanContent({
  onOpen,
  onGenerate,
  isGenerating,
}: {
  onOpen: () => void;
  onGenerate: () => Promise<void>;
  isGenerating: boolean;
}) {
  const router = useRouter();

  const handleGenerateClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering parent button
    await onGenerate();
  };

  const handleManualChoiceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push("/");
  };

  const handleIdeasClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpen();
  };

  return (
    <div className="space-y-3">
      {/* Illustration */}
      <div className="flex justify-center py-3">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#EF8759]/5">
          <div className="text-4xl">☕</div>
        </div>
      </div>

      {/* Text */}
      <div className="space-y-1.5 text-center">
        <h3 className="text-base font-semibold text-neutral-900">
          План на сегодня пока свободен
        </h3>
        <p className="text-sm text-neutral-600 leading-relaxed">
          Можно выбрать самой или доверить mamaGo подобрать идеи под погоду, возраст и настроение семьи.
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button
          type="button"
          disabled={isGenerating}
          onClick={handleGenerateClick}
          className={cn(
            "w-full h-[54px] rounded-full",
            "border border-[#ffb38a] bg-[linear-gradient(180deg,_#ffb185_0%,_#ff8f61_100%)] text-white font-semibold",
            "shadow-[0_16px_30px_rgba(255,146,93,0.34),inset_0_2px_0_rgba(255,255,255,0.42)] transition-all duration-200",
            "hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(255,146,93,0.4),inset_0_2px_0_rgba(255,255,255,0.5)]",
          )}
        >
          <Sparkles className="h-4 w-4" />
          {isGenerating ? "Подбираю..." : "Реши за меня"}
        </Button>
        <button
          type="button"
          onClick={handleManualChoiceClick}
          className={cn(
              "inline-flex w-full h-[54px] items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all duration-200",
            "border border-neutral-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9f9f9_100%)] text-neutral-700",
            "shadow-[0_8px_16px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]",
            "hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,1)]",
          )}
        >
            <Search className="h-4 w-4" />
          Сама выберу
        </button>
        <button
          type="button"
          onClick={handleIdeasClick}
          className="w-full text-sm font-semibold text-[#EF8759] hover:text-[#E07849] transition-colors py-2"
        >
          Выбрать из моих идей
        </button>
      </div>
    </div>
  );
}

function RecommendationsContent({ 
  recommendations,
  selectedPersonas 
}: { 
  recommendations: Array<{
    id: string;
    title: string;
    coverImageUrl?: string | null;
    place?: {
      shortAddress?: string | null;
      formattedAddr?: string | null;
    } | null;
  }>;
  selectedPersonas: Array<{ id: string; name: string; initial: string }>;
}) {
  const { addActivityToPlanFromSuggestion } = useMyPlan();
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());

  const handleAddToPlan = async (activity: typeof recommendations[0], e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering parent button
    setAddingIds(prev => new Set(prev).add(activity.id));
    try {
      await addActivityToPlanFromSuggestion(activity as any);
    } finally {
      setAddingIds(prev => {
        const next = new Set(prev);
        next.delete(activity.id);
        return next;
      });
    }
  };

  const getTimeOfDay = (index: number) => {
    if (index === 0) return "Утро";
    if (index === 1) return "День";
    return "Вечер";
  };

  const personaNames = selectedPersonas.map(p => p.name).join(" и ");

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-neutral-900">
        Вот что я рекомендую сегодня
        {personaNames && (
          <span className="block text-xs font-normal text-neutral-500 mt-0.5">
            для {personaNames}
          </span>
        )}
      </h3>

      {recommendations.map((rec, index) => (
        <div
          key={rec.id}
          className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-2xl">
              {rec.coverImageUrl ? (
                <img 
                  src={rec.coverImageUrl} 
                  alt="" 
                  className="h-full w-full object-cover rounded-xl"
                />
              ) : (
                "🎨"
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-xs font-medium text-neutral-500">{getTimeOfDay(index)}</p>
              <h4 className="text-sm font-semibold text-neutral-900">{rec.title}</h4>
              <div className="flex items-center gap-1.5 text-xs text-[#EF8759]">
                <span className="inline-flex items-center gap-1">
                  ⭐ Рекомендовано mamaGo
                </span>
              </div>
              {rec.place && (
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span className="inline-flex items-center gap-1">
                    📍 {rec.place.shortAddress || rec.place.formattedAddr || "Адрес уточняется"}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={addingIds.has(rec.id)}
              onClick={(e) => handleAddToPlan(rec, e)}
              className={cn(
                "flex-1 h-9 rounded-full text-xs font-semibold disabled:opacity-50",
                "border border-[#ffb38a] bg-[linear-gradient(180deg,_#ffb185_0%,_#ff8f61_100%)] text-white",
                "shadow-[0_8px_16px_rgba(255,146,93,0.3),inset_0_1px_0_rgba(255,255,255,0.4)] transition-all duration-200",
                "hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(255,146,93,0.35),inset_0_1px_0_rgba(255,255,255,0.5)]",
              )}
            >
              {addingIds.has(rec.id) ? "Добавляю..." : "Добавить в план"}
            </Button>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex h-9 items-center gap-1 px-3 rounded-full text-xs font-semibold transition-all duration-200",
                "border border-neutral-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9f9f9_100%)] text-neutral-600",
                "shadow-[0_4px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]",
                "hover:-translate-y-0.5 hover:shadow-[0_6px_12px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,1)]",
              )}
            >
              🔖 Сохранить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function FilledPlanContent({ 
  events,
  selectedPersonas 
}: { 
  events: Array<{
    id: string;
    title: string | null;
    startsAt: string | null;
    activity?: {
      title: string;
      place?: {
        shortAddress?: string | null;
        formattedAddr?: string | null;
      } | null;
    } | null;
  }>;
  selectedPersonas: Array<{ id: string; name: string; initial: string }>;
}) {
  const { clearSlotSaved } = useMyPlan();
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const handleDelete = async (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering parent button
    setDeletingIds(prev => new Set(prev).add(eventId));
    try {
      await clearSlotSaved(eventId);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  };

  const getTimeOfDay = (index: number) => {
    const hour = events[index]?.startsAt 
      ? new Date(events[index].startsAt!).getHours() 
      : 10 + index * 3;
    
    if (hour < 12) return { label: "Утро", icon: "☀️" };
    if (hour < 17) return { label: "День", icon: "🍽️" };
    return { label: "Вечер", icon: "🌙" };
  };

  const formatTime = (startsAt: string | null, index: number) => {
    if (startsAt) {
      const date = new Date(startsAt);
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
    // Default times if not set
    const defaultHour = 10 + index * 3;
    return `${String(defaultHour).padStart(2, '0')}:00`;
  };

  return (
    <div className="space-y-4">
      {/* Timeline */}
      <div className="space-y-3">
        {events.map((event, index) => {
          const timeOfDay = getTimeOfDay(index);
          const showTimeLabel = index === 0 || getTimeOfDay(index - 1).label !== timeOfDay.label;
          
          return (
            <div key={event.id}>
              {showTimeLabel && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-neutral-500">
                    {timeOfDay.icon} {timeOfDay.label}
                  </span>
                </div>
              )}
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="text-sm font-semibold text-neutral-900">
                    {formatTime(event.startsAt, index)}
                  </span>
                  {index < events.length - 1 && (
                    <div className="w-px h-full bg-neutral-200 mt-2" />
                  )}
                </div>
                <div className="flex-1 pb-3">
                  <div className="rounded-xl border border-neutral-100 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-neutral-900">
                          {event.activity?.title || event.title || "Без названия"}
                        </h4>
                        {event.activity?.place && (
                          <p className="text-xs text-neutral-600 mt-0.5">
                            {event.activity.place.shortAddress || event.activity.place.formattedAddr}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {selectedPersonas.slice(0, 3).map((persona, i) => (
                          <div
                            key={i}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-xs"
                            title={persona.name}
                          >
                            {persona.initial}
                          </div>
                        ))}
                        <button
                          type="button"
                          disabled={deletingIds.has(event.id)}
                          onClick={(e) => handleDelete(event.id, e)}
                          className="ml-1 text-neutral-400 hover:text-red-500 disabled:opacity-50"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className={cn(
        "rounded-2xl p-4 text-white transition-all duration-200",
        "border border-[#ffb38a] bg-[linear-gradient(180deg,_#ffb185_0%,_#ff8f61_100%)]",
        "shadow-[0_16px_30px_rgba(255,146,93,0.34),inset_0_2px_0_rgba(255,255,255,0.42)]",
        "hover:shadow-[0_18px_34px_rgba(255,146,93,0.4),inset_0_2px_0_rgba(255,255,255,0.5)]",
      )}>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="w-full"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0 text-left">
              <h4 className="text-sm font-semibold">✨ Собрать сценарий дня</h4>
              <p className="text-xs opacity-90 mt-0.5">
                mamaGo разложит день по времени, переходам и паузам
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
              <ChevronRight className="h-5 w-5" />
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
