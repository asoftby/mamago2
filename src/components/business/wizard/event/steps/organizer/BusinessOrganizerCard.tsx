"use client";

import { Building2, Phone, Globe, Instagram, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BusinessOrganizerCardProps {
  organizer: {
    id?: string;
    name: string;
    legalName?: string | null;
    unp?: string | null;
    phone?: string | null;
    website?: string | null;
    instagram?: string | null;
  };
  onChangeOrganizer?: () => void;
  isEditable?: boolean;
}

export function BusinessOrganizerCard({
  organizer,
  onChangeOrganizer,
  isEditable = true,
}: BusinessOrganizerCardProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-emerald-700" />
          <h3 className="font-semibold text-emerald-950">Организатор выбран</h3>
        </div>
        <p className="text-sm text-emerald-800">
          Мы подставили данные вашей компании из бизнес-профиля.
        </p>
      </div>

      {/* Organizer Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        {/* Name */}
        <div>
          <h4 className="text-lg font-semibold text-gray-900">{organizer.name}</h4>
          {organizer.legalName && organizer.legalName !== organizer.name && (
            <p className="text-sm text-gray-600 mt-1">{organizer.legalName}</p>
          )}
        </div>

        {/* Details */}
        <div className="space-y-3">
          {organizer.unp && (
            <div className="flex items-start gap-3">
              <div className="text-sm text-gray-500 w-20">УНП</div>
              <div className="text-sm font-medium text-gray-900">{organizer.unp}</div>
            </div>
          )}

          {organizer.phone && (
            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 text-gray-400 mt-0.5" />
              <div className="text-sm text-gray-900">{organizer.phone}</div>
            </div>
          )}

          {organizer.website && (
            <div className="flex items-start gap-3">
              <Globe className="h-4 w-4 text-gray-400 mt-0.5" />
              <a
                href={organizer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                {organizer.website}
              </a>
            </div>
          )}

          {organizer.instagram && (
            <div className="flex items-start gap-3">
              <Instagram className="h-4 w-4 text-gray-400 mt-0.5" />
              <a
                href={organizer.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                {organizer.instagram}
              </a>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Эти данные будут использоваться в карточке события и в заявках от клиентов.
          </p>
        </div>

        {/* Change Button */}
        {isEditable && onChangeOrganizer && (
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onChangeOrganizer}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              Изменить организатора
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
