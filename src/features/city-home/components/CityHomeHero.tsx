"use client";

import { useMemo } from "react";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

function whenLabel(preset: string | null): string | null {
  if (preset === "TODAY") return "сегодня";
  if (preset === "TOMORROW") return "завтра";
  if (preset === "WEEKEND") return "на выходные";
  return null;
}

/**
 * Реактивный hero главной страницы.
 * Меняется при изменении контекста (персоны, дата).
 */
export function CityHomeHero() {
  const family = useFamilyPersona();
  const { applied } = useDiscoveryFilters();

  const { contextTitle, greeting } = useMemo(() => {
    const loading = family?.loading ?? true;
    const menuUser = family?.menuUser ?? null;
    const personas = family?.personas ?? [];
    const selectedIds = family?.selectedPersonaIds ?? [];

    const greeting = menuUser
      ? `${getGreeting()}, ${menuUser.displayName?.trim() || menuUser.email?.split("@")[0] || ""}`.trim()
      : getGreeting();

    if (loading) {
      return { contextTitle: "Фамилинг с mamaGo", greeting };
    }

    const when = whenLabel(applied.whenPreset);

    // Выбранные персоны
    const selected = personas.filter((p) => selectedIds.includes(p.id));
    const children = selected.filter((p) => p.kind === "child");
    const hasAdult = selected.some((p) => p.kind === "adult");

    if (children.length === 1 && !hasAdult) {
      const name = children[0]!.displayName;
      return {
        contextTitle: when ? `Идеи для ${name} ${when}` : `Идеи для ${name}`,
        greeting,
      };
    }

    if (children.length > 1 && !hasAdult) {
      const names = children.map((c) => c.displayName).join(" и ");
      return {
        contextTitle: when ? `Идеи для ${names} ${when}` : `Идеи для ${names}`,
        greeting,
      };
    }

    if (children.length >= 1 && hasAdult) {
      return {
        contextTitle: when ? `Для всей семьи ${when}` : "Для всей семьи",
        greeting,
      };
    }

    if (when) {
      return { contextTitle: `Идеи ${when}`, greeting };
    }

    return { contextTitle: "Фамилинг с mamaGo", greeting };
  }, [family, applied.whenPreset]);

  return (
    <div className="space-y-1 px-1">
      {greeting && (
        <p className="text-sm text-neutral-400 font-medium">{greeting}</p>
      )}
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-neutral-900">
        {contextTitle}
      </h1>
      <p className="text-sm text-neutral-500 max-w-xl leading-relaxed pt-0.5">
        Персональный помощник в организации семейного отдыха и развития
      </p>
    </div>
  );
}
