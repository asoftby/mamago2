"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Building2, Search, Plus } from "lucide-react";
import type { BusinessProfile } from "./types";

interface OrganizerSelectorProps {
  business?: BusinessProfile;
  selectedMode: "business" | "existing" | "custom";
  onModeChange: (mode: "business" | "existing" | "custom") => void;
  onCancel: () => void;
  isEditable: boolean;
}

export function OrganizerSelector({ 
  business, 
  selectedMode, 
  onModeChange, 
  onCancel, 
  isEditable 
}: OrganizerSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Кто организует событие?</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-gray-500"
        >
          Отмена
        </Button>
      </div>
      
      <div className="space-y-3">
        {business && (
          <button
            type="button"
            onClick={() => onModeChange("business")}
            disabled={!isEditable}
            className={`w-full p-4 rounded-lg border text-left transition-colors ${
              selectedMode === "business"
                ? "border-primary bg-primary/5"
                : "border-gray-200 hover:border-gray-300"
            } ${!isEditable ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-medium">{business.name}</div>
                <div className="text-sm text-gray-600">Мой бизнес</div>
              </div>
            </div>
          </button>
        )}
        
        <button
          type="button"
          onClick={() => onModeChange("existing")}
          disabled={!isEditable}
          className={`w-full p-4 rounded-lg border text-left transition-colors ${
            selectedMode === "existing"
              ? "border-primary bg-primary/5"
              : "border-gray-200 hover:border-gray-300"
          } ${!isEditable ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="font-medium">Найти организатора</div>
              <div className="text-sm text-gray-600">Выбрать из существующих</div>
            </div>
          </div>
        </button>
        
        <button
          type="button"
          onClick={() => onModeChange("custom")}
          disabled={!isEditable}
          className={`w-full p-4 rounded-lg border text-left transition-colors ${
            selectedMode === "custom"
              ? "border-primary bg-primary/5"
              : "border-gray-200 hover:border-gray-300"
          } ${!isEditable ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Plus className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="font-medium">Создать нового организатора</div>
              <div className="text-sm text-gray-600">Указать данные вручную</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}