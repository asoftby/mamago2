"use client";

import { Home, Utensils, Bus, Shield, Heart } from "lucide-react";
import type { OfferPageData } from "@/lib/offer/offerPageTypes";

interface OfferAccommodationProps {
  data: NonNullable<OfferPageData["accommodation"]>;
}

/**
 * Accommodation Block (для лагерей)
 * Показывает: размещение, питание, инфраструктуру, трансфер, безопасность
 * В виде icon cards
 */
export function OfferAccommodation({ data }: OfferAccommodationProps) {
  if (!data.provided) return null;

  const sections = [
    {
      id: "lodging",
      icon: <Home className="h-6 w-6" />,
      title: "Проживание",
      items: [
        data.type && { label: "Тип размещения", value: data.type },
        data.rooms && { label: "Комнаты", value: data.rooms },
        data.conditions && { label: "Условия", value: data.conditions },
      ].filter(Boolean) as Array<{ label: string; value: string }>,
    },
    {
      id: "meals",
      icon: <Utensils className="h-6 w-6" />,
      title: "Питание",
      items: [
        data.mealInfo && { label: "Режим питания", value: data.mealInfo },
      ].filter(Boolean) as Array<{ label: string; value: string }>,
    },
    {
      id: "transfer",
      icon: <Bus className="h-6 w-6" />,
      title: "Трансфер",
      items: [
        data.transferInfo && { label: "Как добраться", value: data.transferInfo },
      ].filter(Boolean) as Array<{ label: string; value: string }>,
    },
    {
      id: "safety",
      icon: <Shield className="h-6 w-6" />,
      title: "Безопасность",
      items: [
        data.safetyInfo && { label: "Охрана", value: data.safetyInfo },
        data.medicalInfo && { label: "Медпункт", value: data.medicalInfo },
      ].filter(Boolean) as Array<{ label: string; value: string }>,
    },
  ].filter((section) => section.items.length > 0);

  if (sections.length === 0) return null;

  return (
    <section className="space-y-8">
      <h2 className="text-[24px] lg:text-[28px] font-bold text-foreground">Размещение и условия</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {sections.map((section) => (
          <div
            key={section.id}
            className="flex flex-col gap-5 rounded-[32px] border border-border/40 bg-white p-6 lg:p-8 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7F3] text-[#EF8759]">
                {section.icon}
              </div>
              <h3 className="text-[18px] font-bold text-foreground">
                {section.title}
              </h3>
            </div>

            {/* Items */}
            <div className="space-y-4">
              {section.items.map((item, index) => (
                <div key={index} className="space-y-1">
                  {item.label && (
                    <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">
                      {item.label}
                    </p>
                  )}
                  <p className="text-[15px] font-medium text-foreground leading-relaxed">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function getMealLabel(key: string): string {
  const labels: Record<string, string> = {
    breakfast: "Завтрак",
    lunch: "Обед",
    dinner: "Ужин",
    snacks: "Перекусы",
  };
  return labels[key] || key;
}
