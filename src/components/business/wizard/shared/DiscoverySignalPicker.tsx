"use client";

import { useEffect, useState } from "react";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import type { SignalEntityType } from "@prisma/client";

type SignalOption = {
  id: string;
  label: string;
  value: string;
  order: number;
  active: boolean; // false = DEPRECATED
};

type SignalGroup = {
  id: string;
  slug: string;
  title: string;
  icon: string | null;
  order: number;
  options: SignalOption[];
};

interface DiscoverySignalPickerProps {
  /** Тип сущности: PLACE | EVENT | OFFER */
  entityType: SignalEntityType;
  /** Текущие выбранные ID сигналов */
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

/**
 * Пикер DISCOVERY-сигналов для форм Place / Event / Offer.
 *
 * Правила:
 * - Показывает только сигналы с domain=DISCOVERY и entityTypes.includes(entityType)
 * - Загружает все опции (ACTIVE + DEPRECATED) для отображения старых значений
 * - DEPRECATED опции: видны если выбраны, но нельзя выбрать новые
 * - Группирует по родительским сигналам
 */
export function DiscoverySignalPicker({
  entityType,
  value,
  onChange,
  disabled = false,
}: DiscoverySignalPickerProps) {
  const [groups, setGroups] = useState<SignalGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    // Use queueMicrotask to avoid synchronous setState in effect
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    });

    // Загружаем все опции (включая DEPRECATED) для отображения старых значений
    fetch(
      `/api/public/signals/discovery?entityType=${entityType}&includeDeprecated=true`,
    )
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((data: { groups?: SignalGroup[] }) => {
        if (!cancelled) {
          setGroups(data.groups ?? []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(`[DiscoverySignalPicker] Failed to load signals for ${entityType}:`, err);
          setGroups([]);
          setError(err instanceof Error ? err.message : "Failed to load signals");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entityType]);

  if (loading) return <div className="h-12" />; // Placeholder during loading

  if (error) {
    console.warn(`[DiscoverySignalPicker] Error loading signals: ${error}`);
    return <div />; // Silent fail - don't break the form
  }

  // Фильтруем группы: показываем только те, у которых есть опции
  // (либо ACTIVE, либо DEPRECATED но выбранные)
  const visibleGroups = groups
    .map((group) => {
      const visibleOptions = group.options.filter(
        (opt) => opt.active || value.includes(opt.id),
      );
      return { ...group, options: visibleOptions };
    })
    .filter((group) => group.options.length > 0);

  if (visibleGroups.length === 0) return <div />; // Empty state

  const toggle = (optId: string, isActive: boolean) => {
    if (disabled) return;
    const isSelected = value.includes(optId);

    if (isSelected) {
      // Всегда можно снять выбор
      onChange(value.filter((id) => id !== optId));
    } else {
      // Нельзя выбрать DEPRECATED
      if (!isActive) return;
      onChange([...value, optId]);
    }
  };

  return (
    <div className="space-y-5">
      {visibleGroups.map((group) => {
        const items: ChipItem[] = group.options.map((opt) => {
          const isSelected = value.includes(opt.id);
          const isDeprecated = !opt.active;
          // DEPRECATED и не выбрано → disabled
          const isDisabled = disabled || (isDeprecated && !isSelected);

          return {
            id: opt.id,
            label: opt.label,
            active: isSelected,
            disabled: isDisabled,
            onClick: () => toggle(opt.id, opt.active),
            className: isDeprecated && isSelected ? "opacity-70" : undefined,
          };
        });

        return (
          <div key={group.id} className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              {group.icon ? (
                <span className="mr-1.5">{group.icon}</span>
              ) : null}
              {group.title}
            </p>
            <ChipsRow layout="wrap" aria-label={group.title} items={items} />
          </div>
        );
      })}
    </div>
  );
}
