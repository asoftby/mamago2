"use client";

import { useEffect, useState } from "react";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { MAX_OFFER_CATEGORIES } from "@/lib/offers/offerCategories";
import type { OfferProductType } from "../types";

type CategoryOption = { id: string; nameRu: string; slug: string };

interface OfferCategoryPickerProps {
  productType: OfferProductType;
  value: string[];
  onChange: (categoryIds: string[]) => void;
  isEditable: boolean;
}

/** Категории предложения: до 3, справочник зависит от формата (шаг «Что предлагаете»). */
export function OfferCategoryPicker({ productType, value, onChange, isEditable }: OfferCategoryPickerProps) {
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
  const atLimit = value.length >= MAX_OFFER_CATEGORIES;

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((item) => item !== id));
    else if (!atLimit) onChange([...value, id]);
  };

  const items: ChipItem[] = (options ?? []).map((option) => {
    const active = value.includes(option.id);
    return {
      id: option.id,
      label: option.nameRu,
      active,
      disabled: !isEditable || (!active && atLimit),
      onClick: () => toggle(option.id),
    };
  });

  return (
    <section className="space-y-3" aria-label="Категория предложения">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">
          Категория <span className="text-red-500">*</span>
        </h3>
        <p className="text-sm text-muted-foreground">
          Выберите до {MAX_OFFER_CATEGORIES}: по ним предложение находят в каталоге.
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
