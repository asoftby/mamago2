"use client";

import { cn } from "@/lib/utils";
import { IntentType } from "@/hooks/useIntent";
import { Chip } from "@/components/ui/Chip";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

interface ContextFiltersProps {
  currentIntent: IntentType;
  className?: string;
}

// Mock filters for 'kuda'
const KUDA_FILTERS = [
  { id: "today", label: "Сегодня" },
  { id: "tomorrow", label: "Завтра" },
  { id: "weekend", label: "Выходные" },
  { id: "free", label: "Бесплатно" },
  { id: "nearby", label: "Рядом" },
  { id: "age", label: "Возраст" },
];

// Mock filters for 'journal'
const JOURNAL_TOPICS = [
  { id: "development", label: "Развитие" },
  { id: "psychology", label: "Психология" },
  { id: "selections", label: "Подборки" },
  { id: "reviews", label: "Обзоры" },
];

export function ContextFilters({ currentIntent, className }: ContextFiltersProps) {
  
  if (currentIntent === 'birthday') {
    return (
      <div className={cn("rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/10 p-6 flex flex-col sm:flex-row items-center justify-between gap-4", className)}>
        <div className="text-center sm:text-left">
          <h3 className="text-lg font-semibold text-foreground">Соберём праздник за 10 минут</h3>
          <p className="text-sm text-muted-foreground mt-1">От торта до аниматора — всё в одном месте</p>
        </div>
        <PrimaryButton className="w-full sm:w-auto min-w-[200px]">
          Начать подготовку
        </PrimaryButton>
      </div>
    );
  }

  if (currentIntent === 'classes') {
    return (
      <div className={cn("rounded-2xl bg-card border p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3", className)}>
        {/* Mock Selects */}
        <div className="h-10 rounded-md border bg-background px-3 flex items-center text-sm text-muted-foreground">Возраст</div>
        <div className="h-10 rounded-md border bg-background px-3 flex items-center text-sm text-muted-foreground">Направление</div>
        <div className="h-10 rounded-md border bg-background px-3 flex items-center text-sm text-muted-foreground">Район</div>
        <div className="h-10 rounded-md border bg-background px-3 flex items-center text-sm text-muted-foreground">Цена</div>
        <div className="h-10 rounded-md border bg-background px-3 flex items-center text-sm text-muted-foreground">Расписание</div>
      </div>
    );
  }

  if (currentIntent === 'journal') {
    return (
      <div className={cn("flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide", className)}>
        {JOURNAL_TOPICS.map((topic) => (
          <Chip key={topic.id} active={false} onClick={() => {}} className="whitespace-nowrap">
            {topic.label}
          </Chip>
        ))}
      </div>
    );
  }

  // Default: kuda
  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide", className)}>
      {KUDA_FILTERS.map((filter) => (
        <Chip key={filter.id} active={false} onClick={() => {}} className="whitespace-nowrap">
          {filter.label}
        </Chip>
      ))}
    </div>
  );
}
