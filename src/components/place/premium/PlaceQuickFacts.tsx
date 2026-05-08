"use client";

import { Calendar, Globe, Users, MapPin, Clock, Phone } from "lucide-react";

interface PlaceQuickFactsProps {
  yearFounded?: number;
  languages?: string[];
  capacity?: number;
  address?: string;
  workingHours?: string;
  phone?: string;
}

export function PlaceQuickFacts({
  yearFounded,
  languages,
  capacity,
  address,
  workingHours,
  phone,
}: PlaceQuickFactsProps) {
  const facts = [
    yearFounded && {
      icon: Calendar,
      label: "Год основания",
      value: yearFounded.toString(),
    },
    languages && languages.length > 0 && {
      icon: Globe,
      label: "Языки",
      value: languages.join(", "),
    },
    capacity && {
      icon: Users,
      label: "Вместимость",
      value: `до ${capacity} человек`,
    },
    address && {
      icon: MapPin,
      label: "Адрес",
      value: address,
    },
    workingHours && {
      icon: Clock,
      label: "Часы работы",
      value: workingHours,
    },
    phone && {
      icon: Phone,
      label: "Телефон",
      value: phone,
    },
  ].filter(Boolean) as Array<{
    icon: typeof Calendar;
    label: string;
    value: string;
  }>;

  if (facts.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-50 border-y border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {facts.map((fact, index) => {
            const Icon = fact.icon;
            return (
              <div key={index} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <Icon className="w-5 h-5 text-gray-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-500 mb-0.5">
                    {fact.label}
                  </div>
                  <div className="text-base font-semibold text-gray-900 break-words">
                    {fact.value}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
