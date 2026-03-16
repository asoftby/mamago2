"use client";

import { Button } from "@/components/ui/button";
import { Building2, Edit3 } from "lucide-react";
import type { BusinessProfile } from "./types";

interface OrganizerBusinessCardProps {
  business: BusinessProfile;
  onEdit: () => void;
  isEditable: boolean;
}

export function OrganizerBusinessCard({ business, onEdit, isEditable }: OrganizerBusinessCardProps) {
  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-start gap-3">
        {business.logoUrl ? (
          <img
            src={business.logoUrl}
            alt={business.name}
            className="w-12 h-12 rounded-lg object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-gray-500" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900">{business.name}</h3>
          <p className="text-sm text-gray-600 mt-1">
            Используется профиль вашего бизнеса
          </p>
          {business.description && (
            <p className="text-sm text-gray-500 mt-2 line-clamp-2">
              {business.description}
            </p>
          )}
        </div>
        
        {isEditable && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="text-gray-600 hover:text-gray-900"
          >
            <Edit3 className="w-4 h-4 mr-1" />
            Изменить
          </Button>
        )}
      </div>
    </div>
  );
}