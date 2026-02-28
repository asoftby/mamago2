"use client"

import * as React from "react"
import { MultiSelectTab } from "@/components/ui/multiselect-tab"
import { 
  AGE_OPTIONS, 
  DISTRICT_OPTIONS, 
  METRO_OPTIONS,
  CATEGORY_OPTIONS,
  SKILL_OPTIONS,
  TOOL_OPTIONS
} from "@/lib/mocks/filterOptions"
import { useMockFilters } from "@/lib/mocks/useMockFilters"
import { cn } from "@/lib/utils"

interface CityFiltersClientProps {
  intent: string;
}

export function CityFiltersClient({ intent }: CityFiltersClientProps) {
  const { 
    age, setAge, 
    district, setDistrict, 
    metro, setMetro,
    category, setCategory,
    skill, setSkill,
    tool, setTool
  } = useMockFilters()

  const chipsKudaPoyti = [
    { id: "today", label: "Сегодня" },
    { id: "tomorrow", label: "Завтра" },
    { id: "weekend", label: "Выходные" },
    { id: "free", label: "Бесплатно" },
    { id: "near", label: "Рядом" },
  ];

  const [activeChipId, setActiveChipId] = React.useState<string>(chipsKudaPoyti[0]?.id || "");

  const currentChips = chipsKudaPoyti.map(chip => ({
    ...chip,
    active: chip.id === activeChipId,
    onClick: () => setActiveChipId(chip.id)
  }));

  if (intent === 'classes') {
    return (
      <div className="w-full">
        <div className="flex items-start gap-3 overflow-x-auto whitespace-nowrap py-2 no-scrollbar">
          <MultiSelectTab 
            title="Возраст" 
            options={AGE_OPTIONS} 
            value={age} 
            onChange={setAge} 
          />
          <MultiSelectTab 
            title="Категория" 
            options={CATEGORY_OPTIONS} 
            value={category} 
            onChange={setCategory} 
          />
          <MultiSelectTab 
            title="Навык" 
            options={SKILL_OPTIONS} 
            value={skill} 
            onChange={setSkill} 
          />
          <MultiSelectTab 
            title="Инструмент" 
            options={TOOL_OPTIONS} 
            value={tool} 
            onChange={setTool} 
          />
          <MultiSelectTab 
            title="Район" 
            options={DISTRICT_OPTIONS} 
            value={district} 
            onChange={setDistrict} 
          />
          <MultiSelectTab 
            title="Метро" 
            options={METRO_OPTIONS} 
            value={metro} 
            onChange={setMetro} 
          />
        </div>
      </div>
    );
  }

  // Kuda Poyti intent
  return (
    <div className="w-full">
      <div className="flex items-start gap-3 overflow-x-auto whitespace-nowrap py-2 no-scrollbar">
        {currentChips.map((it) => {
          const isActive = !!it.active
          return (
            <button
              key={it.id}
              type="button"
              onClick={it.onClick}
              className={cn(
                "h-11 px-5 rounded-full border bg-background",
                "text-sm font-medium text-foreground",
                "transition-colors",
                "disabled:opacity-50 disabled:pointer-events-none",
                isActive ? "border-primary/50 bg-primary/50" : "border-border"
              )}
            >
              {it.label}
            </button>
          )
        })}
        <MultiSelectTab 
          title="Возраст" 
          options={AGE_OPTIONS} 
          value={age} 
          onChange={setAge} 
        />
      </div>
    </div>
  );
}
