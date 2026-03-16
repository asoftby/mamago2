"use client";

import { Button } from "@/components/ui/button";
import { Building2, Phone, Globe, CheckCircle, Edit3 } from "lucide-react";
import type { ExistingOrganizer, OrganizerData } from "./types";

interface OrganizerPreviewCardProps {
  organizer: ExistingOrganizer | OrganizerData;
  onEdit: () => void;
  isEditable: boolean;
  isExisting?: boolean;
}

export function OrganizerPreviewCard({ 
  organizer, 
  onEdit, 
  isEditable, 
  isExisting = false 
}: OrganizerPreviewCardProps) {
  const isVerified = isExisting && "isVerified" in organizer && organizer.isVerified;

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-start gap-3">
        {organizer.logoUrl ? (
          <img
            src={organizer.logoUrl}
            alt={organizer.name}
            className="w-12 h-12 rounded-lg object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-gray-500" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{organizer.name}</h3>
            {isVerified && (
              <CheckCircle className="w-4 h-4 text-green-600" />
            )}
          </div>
          
          {organizer.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {organizer.description}
            </p>
          )}
          
          <div className="flex flex-wrap gap-4 mt-2">
            {organizer.phone && (
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Phone className="w-3 h-3" />
                {organizer.phone}
              </div>
            )}
            {organizer.website && (
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Globe className="w-3 h-3" />
                Сайт
              </div>
            )}
          </div>
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