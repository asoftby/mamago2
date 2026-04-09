"use client";

import { useCallback, useMemo } from "react";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { MAX_ACTIVE_FAMILY_PERSONAS } from "@/lib/family/wholeFamilyPreset";

export type ChildScopeOption = {
  id: string;
  name: string;
  birthDate?: string;
};

export type AgeRangeSelection = {
  range: string;
  source: "child" | "manual";
  childId?: string;
};

export function deriveAgeRangesFromChildren(
  children: ChildScopeOption[],
  selectedChildrenIds: string[],
): AgeRangeSelection[] {
  const byRange = new Map<string, AgeRangeSelection>();

  for (const child of children) {
    if (!selectedChildrenIds.includes(child.id)) continue;
    if (!child.birthDate) continue;
    const b = new Date(child.birthDate);
    if (Number.isNaN(b.getTime())) continue;
    const now = new Date();
    let years = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) years -= 1;
    const group = AGE_GROUPS.find(
      (g) => years >= g.min && (g.max == null || years <= g.max),
    );
    if (!group) continue;
    if (!byRange.has(group.value)) {
      byRange.set(group.value, {
        range: group.value,
        source: "child",
        childId: child.id,
      });
    }
  }

  return Array.from(byRange.values());
}

export function mergeAgeRanges(
  childRanges: AgeRangeSelection[],
  appliedAgeRanges: string[],
): AgeRangeSelection[] {
  const childSet = new Set(childRanges.map((r) => r.range));
  const manual = appliedAgeRanges
    .filter((range) => !childSet.has(range))
    .map((range) => ({ range, source: "manual" as const }));
  return [...childRanges, ...manual];
}

export function buildChildrenLabel(
  children: ChildScopeOption[],
  selectedChildrenIds: string[],
  options?: { freeSearchMode?: boolean },
): string {
  // Free search mode: no personalization
  if (options?.freeSearchMode) {
    return "Свободный поиск";
  }
  
  // No children or none selected
  if (children.length === 0 || selectedChildrenIds.length === 0) {
    return "Выберите ребенка";
  }
  
  const selectedNames = children
    .filter((c) => selectedChildrenIds.includes(c.id))
    .map((c) => c.name);
  if (selectedNames.length === 1) return selectedNames[0];
  if (selectedNames.length === 2) return `${selectedNames[0]}, ${selectedNames[1]}`;
  return `${selectedNames.slice(0, 2).join(", ")} +${selectedNames.length - 2}`;
}

export type ChildrenScopeFamilySync = {
  loading: boolean;
  selectedPersonaIds: string[];
  primaryAdultPersonaId: string | null;
  setSelectedPersonaIds: (ids: string[]) => void;
};

export function useChildrenScope(params: {
  citySlug: string;
  availableChildren: ChildScopeOption[];
  appliedAgeRanges: string[];
  setAppliedAgeRanges: (nextAgeRanges: string[]) => void;
  /**
   * Единый контекст «Для кого» с FamilyPersonaContext (selectedPersonaIds + primary adult).
   * Это ЕДИНСТВЕННЫЙ источник истины для выбора персон.
   */
  familySync?: ChildrenScopeFamilySync | null;
}) {
  const { citySlug, availableChildren, appliedAgeRanges, setAppliedAgeRanges, familySync } =
    params;

  const allowedChildSet = useMemo(
    () => new Set(availableChildren.map((c) => c.id)),
    [availableChildren],
  );

  /**
   * Выбранные дети - берём ТОЛЬКО из FamilyPersonaContext (единый источник истины).
   * Фильтруем только детей (исключаем взрослого).
   */
  const selectedChildrenIds = useMemo(() => {
    if (availableChildren.length === 0) return [];

    // Используем FamilyPersonaContext как единственный источник истины
    if (familySync && !familySync.loading && familySync.primaryAdultPersonaId) {
      // Фильтруем только детей (исключаем взрослого)
      return familySync.selectedPersonaIds.filter((id) =>
        allowedChildSet.has(id),
      );
    }

    // Fallback: все дети (если контекст ещё не загружен)
    return availableChildren.map((c) => c.id);
  }, [availableChildren, allowedChildSet, familySync]);

  /**
   * Обновление выбора детей - всегда через FamilyPersonaContext.
   * Автоматически управляет включением/исключением взрослого.
   */
  const setSelectedChildrenIds = useCallback(
    (
      nextIds: string[],
      opts?: { adultIncluded?: boolean },
    ) => {
      const sanitized = nextIds.filter((id) => allowedChildSet.has(id));

      if (
        familySync &&
        !familySync.loading &&
        familySync.primaryAdultPersonaId
      ) {
        const adultId = familySync.primaryAdultPersonaId;
        
        // Определяем, включён ли взрослый
        const adultIncluded =
          opts?.adultIncluded !== undefined
            ? opts.adultIncluded
            : familySync.selectedPersonaIds.includes(adultId);
        
        // Ограничение: максимум 3 персоны
        const maxKids = adultIncluded
          ? Math.max(0, MAX_ACTIVE_FAMILY_PERSONAS - 1)
          : MAX_ACTIVE_FAMILY_PERSONAS;
        
        const nextChildSelection = sanitized.slice(0, maxKids);
        
        // Формируем итоговый список персон
        const personaIds = [
          ...(adultIncluded ? [adultId] : []),
          ...nextChildSelection,
        ];
        
        // Обновляем единый источник истины
        familySync.setSelectedPersonaIds(personaIds);
        
        // Синхронизируем возрастные диапазоны
        const childRanges = deriveAgeRangesFromChildren(
          availableChildren,
          nextChildSelection,
        );
        setAppliedAgeRanges(childRanges.map((r) => r.range));
        return;
      }

      // Fallback: если контекст недоступен, обновляем только возраст
      const childRanges = deriveAgeRangesFromChildren(availableChildren, sanitized);
      setAppliedAgeRanges(childRanges.map((r) => r.range));
    },
    [
      allowedChildSet,
      availableChildren,
      familySync,
      setAppliedAgeRanges,
    ],
  );

  const childDerivedRanges = useMemo(
    () => deriveAgeRangesFromChildren(availableChildren, selectedChildrenIds),
    [availableChildren, selectedChildrenIds],
  );

  const selectedAgeRanges = useMemo(
    () => mergeAgeRanges(childDerivedRanges, appliedAgeRanges),
    [appliedAgeRanges, childDerivedRanges],
  );

  const setSelectedAgeRanges = useCallback(
    (next: AgeRangeSelection[]) => {
      setAppliedAgeRanges(next.map((r) => r.range));
    },
    [setAppliedAgeRanges],
  );

  /**
   * Режим "Свободный поиск": когда в FamilyPersonaContext ничего не выбрано.
   * Это означает отсутствие персонализации.
   */
  const freeSearchMode =
    !!familySync &&
    !familySync.loading &&
    !!familySync.primaryAdultPersonaId &&
    familySync.selectedPersonaIds.length === 0;

  /**
   * Автоматические возрастные значения: из выбранных детей + взрослый если включён.
   */
  const autoAgeValues = useMemo(() => {
    const fromChildren = childDerivedRanges.map((r) => r.range);
    const adultId = familySync?.primaryAdultPersonaId;
    
    // Добавляем 18+ если взрослый выбран и этот диапазон применён
    if (
      !adultId ||
      !familySync ||
      familySync.loading ||
      !familySync.selectedPersonaIds.includes(adultId) ||
      !appliedAgeRanges.includes("18+")
    ) {
      return fromChildren;
    }
    
    if (fromChildren.includes("18+")) return fromChildren;
    return [...fromChildren, "18+"];
  }, [
    childDerivedRanges,
    appliedAgeRanges,
    familySync,
  ]);

  return {
    citySlug,
    selectedChildrenIds,
    setSelectedChildrenIds,
    selectedAgeRanges,
    setSelectedAgeRanges,
    childrenLabel: buildChildrenLabel(availableChildren, selectedChildrenIds, {
      freeSearchMode,
    }),
    autoAgeValues,
  };
}
