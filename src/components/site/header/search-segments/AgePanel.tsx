"use client";

import { Users, Baby, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { useFilterUpdater } from "./filterUtils";

interface AgePanelProps {
  onClose: () => void;
  applied: any;
  actions: any;
}

export function AgePanel({ onClose, applied, actions }: AgePanelProps) {
  const { updateFilters } = useFilterUpdater();
  
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
    
    updateFilters({ age: newAges });
  };

  const getAgeIcon = (ageValue: string) => {
    if (ageValue.includes("0-") || ageValue.includes("1-")) return Baby;
    if (ageValue.includes("2-") || ageValue.includes("3-") || ageValue.includes("4-") || ageValue.includes("5-")) return Users;
    return User;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Возраст детей</h3>
        
        <div className="grid grid-cols-2 gap-3">
          {AGE_GROUPS.map((ageGroup) => {
            const isSelected = applied.age.includes(ageGroup.value);
            const IconComponent = getAgeIcon(ageGroup.value);
            
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

        {/* Clear All Filters - Gray X in light circle */}
        {applied.age.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-center">
            <button
              onClick={() => updateFilters({ age: [] })}
              className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors group"
              title="Сбросить все фильтры"
            >
              <X className="h-5 w-5 text-gray-500 group-hover:text-gray-700" />
            </button>
          </div>
        )}

        {/* Apply Button */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full bg-[#EF8759] text-white font-medium py-3 px-4 rounded-xl hover:bg-[#EF8759]/90 transition-colors"
          >
            Применить
          </button>
        </div>

        {/* Future: Add adults/children count here */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="text-xs text-gray-400">
            В будущем здесь будет выбор количества взрослых и детей
          </div>
        </div>
      </div>
    </div>
  );
}