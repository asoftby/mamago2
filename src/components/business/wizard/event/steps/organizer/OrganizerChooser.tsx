"use client";

import { Building2, Search, Plus, CheckCircle } from "lucide-react";
import type { BusinessProfile } from "./types";

interface OrganizerOption {
  id: string;
  type: "default" | "search" | "create";
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  isRecommended?: boolean;
  isSelected?: boolean;
}

interface OrganizerChooserProps {
  defaultOrganizer?: BusinessProfile;
  selectedMode: "business" | "existing" | "custom";
  onModeChange: (mode: "business" | "existing" | "custom") => void;
  isEditable: boolean;
}

export function OrganizerChooser({ 
  defaultOrganizer, 
  selectedMode, 
  onModeChange, 
  isEditable 
}: OrganizerChooserProps) {
  const options: OrganizerOption[] = [
    // Default organizer option (only if available)
    ...(defaultOrganizer ? [{
      id: "default",
      type: "default" as const,
      title: defaultOrganizer.name,
      subtitle: "Использовать профиль по умолчанию",
      icon: Building2,
      isRecommended: true,
      isSelected: selectedMode === "business",
    }] : []),
    
    // Search existing organizer
    {
      id: "search",
      type: "search" as const,
      title: "Найти организатора",
      subtitle: "Выбрать из существующих",
      icon: Search,
      isSelected: selectedMode === "existing",
    },
    
    // Create new organizer
    {
      id: "create",
      type: "create" as const,
      title: "Создать нового организатора",
      subtitle: "Указать данные вручную",
      icon: Plus,
      isSelected: selectedMode === "custom",
    },
  ];

  const handleOptionClick = (option: OrganizerOption) => {
    if (!isEditable) return;
    
    switch (option.type) {
      case "default":
        onModeChange("business");
        break;
      case "search":
        onModeChange("existing");
        break;
      case "create":
        onModeChange("custom");
        break;
    }
  };

  return (
    <div className="space-y-3">
      {options.map((option) => {
        const IconComponent = option.icon;
        
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => handleOptionClick(option)}
            disabled={!isEditable}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
              option.isSelected
                ? option.isRecommended
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-primary bg-primary/5"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            } ${!isEditable ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                option.isSelected
                  ? option.isRecommended
                    ? "bg-primary text-white"
                    : "bg-primary/10 text-primary"
                  : "bg-gray-100 text-gray-600"
              }`}>
                <IconComponent className="w-6 h-6" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={`font-medium truncate ${
                    option.isSelected ? "text-gray-900" : "text-gray-800"
                  }`}>
                    {option.title}
                  </h3>
                  
                  {option.isRecommended && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      <CheckCircle className="w-3 h-3" />
                      Рекомендуется
                    </span>
                  )}
                </div>
                
                <p className={`text-sm ${
                  option.isSelected ? "text-gray-600" : "text-gray-500"
                }`}>
                  {option.subtitle}
                </p>
                
                {/* Additional info for default organizer */}
                {option.type === "default" && defaultOrganizer && (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                    {defaultOrganizer.phone && (
                      <span>{defaultOrganizer.phone}</span>
                    )}
                    {defaultOrganizer.website && (
                      <span>Сайт указан</span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Selection indicator */}
              {option.isSelected && (
                <div className="flex-shrink-0">
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}