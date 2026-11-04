"use client";

import { useEffect, useState } from "react";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { MAX_OFFER_CATEGORIES } from "@/lib/offers/offerCategories";
import type { OfferProductType } from "../types";

type CategoryOption = { id: string; nameRu: string; slug: string };

interface OfferCategoryPickerProps {
  productType: OfferProductType;
  value: string[];
  onChange: (categoryIds: string[], selectedOption?: CategoryOption) => void;
  isEditable: boolean;
  /** Single-service offers have one primary category; other offer types can select up to 3. */
  maxSelected?: number;
}

/** Категории предложения: до 3, справочник зависит от формата (шаг «Что предлагаете»). */
export function OfferCategoryPicker({ productType, value, onChange, isEditable, maxSelected = MAX_OFFER_CATEGORIES }: OfferCategoryPickerProps) {
  const [loaded, setLoaded] = useState<{ productType: OfferProductType; options: CategoryOption[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/business/offer-categories?productType=${encodeURIComponent(productType)}`, {
      credentials: "include",
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("load_failed"))))
      .then((payload: { categories?: CategoryOption[] }) => {
        if (cancelled) return;
        setFailed(false);
        setLoaded({ productType, options: payload.categories ?? [] });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [productType]);

  const options = loaded?.productType === productType ? loaded.options : null;
  const atLimit = value.length >= maxSelected;

  const toggle = (option: CategoryOption) => {
    if (value.includes(option.id)) {
      onChange(value.filter((item) => item !== option.id), option);
    } else if (maxSelected === 1) {
      // Selecting a different service replaces the old category; never trap the user at the limit.
      onChange([option.id], option);
    } else if (!atLimit) {
      onChange([...value, option.id], option);
    }
  };

  const items: ChipItem[] = (options ?? []).map((option) => {
    const active = value.includes(option.id);
    return {
      id: option.id,
      label: option.nameRu,
      active,
      disabled: !isEditable || (!active && atLimit && maxSelected !== 1),
      onClick: () => toggle(option),
    };
  });

  return (
    <section className="space-y-3" aria-label="Категория предложения">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">
          Категория <span className="text-red-500">*</span>
        </h3>
        <p className="text-sm text-muted-foreground">
          {maxSelected === 1 ? "Выберите один вид услуги." : `Выберите до ${maxSelected}: по ним предложение находят в каталоге.`}
        </p>
      </div>
      {failed ? (
        <p className="text-sm text-destructive">Не удалось загрузить категории. Обновите страницу.</p>
      ) : options === null ? (
        <p className="text-sm text-muted-foreground">Загружаем категории…</p>
      ) : options.length === 0 ? (
        <p className="text-sm text-muted-foreground">Для этого формата категории пока не настроены.</p>
      ) : (
        <ChipsRow layout="wrap" aria-label="Категория предложения" items={items} />
      )}
    </section>
  );
}
