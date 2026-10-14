"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { Switch } from "@/components/ui/switch";
import {
  BUSINESS_FEATURE_KEYS,
  BUSINESS_FEATURE_LABELS,
  type BusinessFeatureKey,
  type BusinessFeatures,
} from "@/lib/business/businessFeatures";

export function BusinessFeaturesControl({
  businessId,
  initialFeatures,
  readOnly = false,
}: {
  businessId: string;
  initialFeatures: BusinessFeatures;
  readOnly?: boolean;
}) {
  const [features, setFeatures] = useState<BusinessFeatures>(initialFeatures);
  const [pending, setPending] = useState<BusinessFeatureKey | null>(null);

  const toggle = async (key: BusinessFeatureKey, next: boolean) => {
    setPending(key);
    try {
      const res = await fetch(`/api/admin/business/${businessId}/features`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Ошибка сохранения");
      }
      setFeatures(data.features as BusinessFeatures);
      toast.success(next ? "Функция включена" : "Функция выключена");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setPending(null);
    }
  };

  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      aria-labelledby="business-features-title"
    >
      <h3 id="business-features-title" className="text-base font-semibold text-gray-900">
        Функции бизнеса
      </h3>
      <ul className="mt-4 space-y-4">
        {BUSINESS_FEATURE_KEYS.map((key) => {
          const label = BUSINESS_FEATURE_LABELS[key];
          return (
            <li key={key} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">{label.title}</p>
                <p className="mt-0.5 text-sm text-gray-600">{label.description}</p>
              </div>
              <Switch
                checked={features[key]}
                disabled={readOnly || pending !== null}
                onCheckedChange={(next) => void toggle(key, next)}
                aria-label={label.title}
              />
            </li>
          );
        })}
      </ul>
      {readOnly && (
        <p className="mt-3 text-xs text-muted-foreground">Изменить функции может только администратор.</p>
      )}
    </section>
  );
}
