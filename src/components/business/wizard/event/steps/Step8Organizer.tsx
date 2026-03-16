"use client";

import { useState, useEffect } from "react";
import { Building2, Search, Plus, CheckCircle } from "lucide-react";
import type { EventFormData } from "../types";
import { OrganizerSearchSelect } from "./organizer/OrganizerSearchSelect";
import { OrganizerCreateForm } from "./organizer/OrganizerCreateForm";
import type { BusinessProfile, ExistingOrganizer, UserRole } from "./organizer/types";

interface Step8OrganizerProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  isEditable: boolean;
  userRole?: UserRole;
}

// Mock business data - в реальном приложении будет получаться из контекста
const MOCK_BUSINESS: BusinessProfile = {
  id: "business-1",
  name: "Детский центр Солнышко",
  description: "Развивающие занятия и мероприятия для детей",
  phone: "+375 29 123 45 67",
  website: "https://solnyshko.by",
  logoUrl: null,
};

export function Step8Organizer({ data, onChange, isEditable, userRole }: Step8OrganizerProps) {
  const [selectedExistingOrganizer, setSelectedExistingOrganizer] = useState<ExistingOrganizer | null>(null);

  // Determine user role and business context
  const isBusiness = userRole?.role === "BUSINESS_OWNER";
  const isAdminModerator = userRole?.role === "ADMIN" || userRole?.role === "MODERATOR";
  const business = userRole?.business || (isBusiness ? MOCK_BUSINESS : undefined);

  // Fallback: if no userRole provided, assume business user for now
  const effectiveIsBusiness = userRole ? isBusiness : true;
  const effectiveBusiness = business || MOCK_BUSINESS;

  // Determine default organizer (only for business users)
  const defaultOrganizer = effectiveIsBusiness ? effectiveBusiness : undefined;

  // Initialize default state based on user role
  useEffect(() => {
    if (defaultOrganizer && data.organizerMode === "business" && !data.organizerName) {
      // Auto-populate business data
      onChange({
        organizerName: defaultOrganizer.name,
        organizerDescription: defaultOrganizer.description || "",
        organizerPhone: defaultOrganizer.phone || "",
        organizerWebsite: defaultOrganizer.website || "",
        organizerLogoUrl: defaultOrganizer.logoUrl,
      });
    }
  }, [defaultOrganizer, data.organizerMode, data.organizerName, onChange]);

  const handleModeChange = (mode: "business" | "existing" | "custom") => {
    if (mode === "business" && defaultOrganizer) {
      onChange({
        organizerMode: mode,
        organizerId: null,
        organizerName: defaultOrganizer.name,
        organizerDescription: defaultOrganizer.description || "",
        organizerPhone: defaultOrganizer.phone || "",
        organizerWebsite: defaultOrganizer.website || "",
        organizerLogoUrl: defaultOrganizer.logoUrl,
      });
    } else if (mode === "existing") {
      onChange({ 
        organizerMode: mode,
        organizerId: null,
        organizerName: "",
        organizerDescription: "",
        organizerPhone: "",
        organizerWebsite: "",
        organizerLogoUrl: null,
      });
      setSelectedExistingOrganizer(null);
    } else if (mode === "custom") {
      onChange({
        organizerMode: mode,
        organizerId: null,
        organizerName: "",
        organizerDescription: "",
        organizerPhone: "",
        organizerWebsite: "",
        organizerLogoUrl: null,
      });
    }
  };

  const handleExistingOrganizerSelect = (organizer: ExistingOrganizer | null) => {
    if (organizer) {
      setSelectedExistingOrganizer(organizer);
      onChange({
        organizerId: organizer.id,
        organizerName: organizer.name,
        organizerDescription: organizer.description || "",
        organizerPhone: organizer.phone || "",
        organizerWebsite: organizer.website || "",
        organizerLogoUrl: organizer.logoUrl || null,
      });
    } else {
      setSelectedExistingOrganizer(null);
      onChange({
        organizerId: null,
        organizerName: "",
        organizerDescription: "",
        organizerPhone: "",
        organizerWebsite: "",
        organizerLogoUrl: null,
      });
    }
  };

  const handleCustomOrganizerChange = (updates: Partial<{
    name: string;
    description: string;
    phone: string;
    website: string;
    logoUrl: string | null;
  }>) => {
    onChange({
      organizerName: updates.name ?? data.organizerName,
      organizerDescription: updates.description ?? data.organizerDescription,
      organizerPhone: updates.phone ?? data.organizerPhone,
      organizerWebsite: updates.website ?? data.organizerWebsite,
      organizerLogoUrl: updates.logoUrl ?? data.organizerLogoUrl,
    });
  };

  const organizerOptions = [
    // Default organizer option (only if available)
    ...(defaultOrganizer ? [{
      id: "business",
      title: defaultOrganizer.name,
      subtitle: "Использовать профиль по умолчанию",
      icon: Building2,
      isRecommended: true,
      isSelected: data.organizerMode === "business",
    }] : []),
    
    // Search existing organizer
    {
      id: "existing",
      title: "Найти организатора",
      subtitle: "Выбрать из существующих",
      icon: Search,
      isSelected: data.organizerMode === "existing",
    },
    
    // Create new organizer
    {
      id: "custom",
      title: "Создать нового организатора",
      subtitle: "Указать данные вручную",
      icon: Plus,
      isSelected: data.organizerMode === "custom",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Организатор</h2>
        <p className="text-sm text-muted-foreground">
          Выберите, кто организует это событие
        </p>
      </div>

      {/* Organizer Options with Nested Content */}
      <div className="space-y-3">
        {organizerOptions.map((option) => {
          const IconComponent = option.icon;
          const isSelected = option.isSelected;
          
          return (
            <div
              key={option.id}
              className={`rounded-xl border-2 transition-all duration-200 ${
                isSelected
                  ? option.isRecommended
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-primary bg-primary/5"
                  : "border-gray-200"
              }`}
            >
              <button
                type="button"
                onClick={() => handleModeChange(option.id as "business" | "existing" | "custom")}
                disabled={!isEditable}
                className={`w-full p-4 text-left transition-all duration-200 ${
                  !isEditable ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"
                } ${isSelected ? "" : "hover:bg-gray-50"}`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected
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
                        isSelected ? "text-gray-900" : "text-gray-800"
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
                      isSelected ? "text-gray-600" : "text-gray-500"
                    }`}>
                      {option.subtitle}
                    </p>
                    
                    {/* Additional info for default organizer */}
                    {option.id === "business" && defaultOrganizer && (
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
                  {isSelected && (
                    <div className="flex-shrink-0">
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              </button>

              {/* Nested Content */}
              {isSelected && option.id === "business" && defaultOrganizer && (
                <div className="px-4 pb-4 transition-all duration-200 ease-out">
                  <div className="border-t border-primary/20 pt-4">
                    <div className="bg-white border border-primary/20 rounded p-3 text-sm text-gray-700">
                      <strong>Как это работает:</strong> Событие будет опубликовано от имени этого организатора.
                    </div>
                  </div>
                </div>
              )}

              {isSelected && option.id === "existing" && (
                <div className="px-4 pb-4 transition-all duration-200 ease-out">
                  <div className="border-t border-primary/20 pt-4">
                    <OrganizerSearchSelect
                      selectedOrganizer={selectedExistingOrganizer}
                      onSelect={handleExistingOrganizerSelect}
                      isEditable={isEditable}
                    />
                  </div>
                </div>
              )}

              {isSelected && option.id === "custom" && (
                <div className="px-4 pb-4 transition-all duration-200 ease-out">
                  <div className="border-t border-primary/20 pt-4">
                    <OrganizerCreateForm
                      data={{
                        name: data.organizerName,
                        description: data.organizerDescription,
                        phone: data.organizerPhone,
                        website: data.organizerWebsite,
                        logoUrl: data.organizerLogoUrl,
                      }}
                      onChange={handleCustomOrganizerChange}
                      isEditable={isEditable}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
