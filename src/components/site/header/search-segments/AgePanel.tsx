"use client";

import { Balloon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";

interface AgePanelProps {
  onClose: () => void;
  applied: any;
  actions: any;
}

export function AgePanel({ onClose, applied, actions }: AgePanelProps) {
  const handleAgeToggle = (ageValue: string) => {
    const currentAges = applied.age || [];
    let newAges: string[];
    
    if (currentAges.includes(ageValue)) {
      // Remove age
      newAges = currentAges.filter((age: string) => age !== ageValue);
    } else {
      // Add age
      newAges = [...currentAges, ageValue];
    }
    
    // Always use setDraft from actions (works for both desktop and mobile)
    actions.setDraft({ age: newAges });
  };

  const getAgeIcon = () => {
    return Balloon;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Возраст детей</h3>
        
        <div className="grid grid-cols-2 gap-3">
          {AGE_GROUPS.map((ageGroup) => {
            const isSelected = applied.age.includes(ageGroup.value);
            const IconComponent = getAgeIcon();
            
            return (
              <button
                key={ageGroup.value}
                onClick={() => handleAgeToggle(ageGroup.value)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border transition-colors text-left",
                  isSelected
                    ? "border-[#EF8759] bg-[#EF8759]/5 text-[#EF8759]"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full",
                  isSelected ? "bg-[#EF8759]/10" : "bg-gray-100"
                )}>
                  <IconComponent className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{ageGroup.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}