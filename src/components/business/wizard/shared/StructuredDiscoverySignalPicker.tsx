"use client";

import { useEffect, useState } from "react";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import type { SignalEntityType } from "@prisma/client";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

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

interface GroupConfig {
  slug: string;
  title: string;
  required: boolean;
  min?: number;
  max?: number;
  helperText?: string;
}

interface StructuredDiscoverySignalPickerProps {
  /** Тип сущности: PLACE | EVENT | OFFER */
  entityType: SignalEntityType;
  /** Текущие выбранные ID сигналов */
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  /** Конфигурация групп с валидацией */
  groupConfigs: GroupConfig[];
}

/**
 * Структурированный пикер DISCOVERY-сигналов для Offer.
 *
 * Отличия от обычного DiscoverySignalPicker:
 * - Показывает только указанные группы в заданном порядке
 * - Добавляет валидацию min/max для каждой группы
 * - Показывает требования (обязательные/опциональные)
 * - Блокирует выбор при достижении максимума
 */
export function StructuredDiscoverySignalPicker({
  entityType,
  value,
  onChange,
  disabled = false,
  groupConfigs,
}: StructuredDiscoverySignalPickerProps) {
  const [groups, setGroups] = useState<SignalGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

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
          console.error(`[StructuredDiscoverySignalPicker] Failed to load signals for ${entityType}:`, err);
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
    console.warn(`[StructuredDiscoverySignalPicker] Error loading signals: ${error}`);
    return <div />; // Silent fail - don't break the form
  }

  const toggle = (optId: string, isActive: boolean, groupSlug: string) => {
    if (disabled) return;
    const isSelected = value.includes(optId);

    // Находим конфигурацию группы
    const config = groupConfigs.find((c) => c.slug === groupSlug);
    if (!config) return;

    // Находим группу сигналов
    const group = groups.find((g) => g.slug === groupSlug);
    if (!group) return;

    // Считаем текущее количество выбранных в этой группе
    const selectedInGroup = value.filter((id) =>
      group.options.some((opt) => opt.id === id)
    );

    if (isSelected) {
      // Всегда можно снять выбор
      onChange(value.filter((id) => id !== optId));
    } else {
      // Нельзя выбрать DEPRECATED
      if (!isActive) return;

      // Проверяем максимум
      if (config.max && selectedInGroup.length >= config.max) {
        return; // Достигнут максимум
      }

      onChange([...value, optId]);
    }
  };

  // Фильтруем и сортируем группы согласно конфигурации
  const orderedGroups = groupConfigs
    .map((config) => {
      const group = groups.find((g) => g.slug === config.slug);
      if (!group) return null;

      // Фильтруем опции: показываем ACTIVE или DEPRECATED но выбранные
      const visibleOptions = group.options.filter(
        (opt) => opt.active || value.includes(opt.id),
      );

      return {
        ...group,
        options: visibleOptions,
        config,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null && g.options.length > 0);

  if (orderedGroups.length === 0) return <div />; // Empty state

  return (
    <div className="space-y-6">
      {orderedGroups.map((group) => {
        const config = group.config;

        // Считаем выбранные в этой группе
        const selectedInGroup = value.filter((id) =>
          group.options.some((opt) => opt.id === id)
        );
        const selectedCount = selectedInGroup.length;

        // Проверяем валидацию
        const isValid =
          (!config.min || selectedCount >= config.min) &&
          (!config.max || selectedCount <= config.max);

        const isMaxReached = config.max ? selectedCount >= config.max : false;

        const items: ChipItem[] = group.options.map((opt) => {
          const isSelected = value.includes(opt.id);
          const isDeprecated = !opt.active;
          // DEPRECATED и не выбрано → disabled
          // Или достигнут максимум и не выбрано → disabled
          const isDisabled =
            disabled ||
            (isDeprecated && !isSelected) ||
            (isMaxReached && !isSelected);

          return {
            id: opt.id,
            label: opt.label,
            active: isSelected,
            disabled: isDisabled,
            onClick: () => toggle(opt.id, opt.active, group.slug),
            className: isDeprecated && isSelected ? "opacity-70" : undefined,
          };
        });

        return (
          <div key={group.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-gray-900">
                {config.title}
              </Label>
              {config.required ? (
                <Badge variant="default" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                  Обязательно
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  Опционально
                </Badge>
              )}
              {config.max && (
                <span className="text-xs text-gray-500">
                  {selectedCount}/{config.max}
                </span>
              )}
            </div>

            {config.helperText && (
              <p className="text-xs text-muted-foreground">{config.helperText}</p>
            )}

            <ChipsRow layout="masonry" aria-label={config.title} items={items} />

            {/* Валидация */}
            {!isValid && config.min && selectedCount < config.min && (
              <p className="text-xs text-red-500">
                Выберите минимум {config.min} {config.min === 1 ? "вариант" : "варианта"}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
