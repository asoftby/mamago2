"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  options?: { freeWhoMode?: boolean },
): string {
  if (options?.freeWhoMode) {
    return "Для всех";
  }
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
   * Пока loading — источник выбора детей остаётся URL (как раньше).
   */
  familySync?: ChildrenScopeFamilySync | null;
}) {
  const { citySlug, availableChildren, appliedAgeRanges, setAppliedAgeRanges, familySync } =
    params;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  /**
   * После того как мы сами обновили ?children= из выбора семьи, один проход импорта URL→семья
   * нужно пропустить — иначе старый query ещё раз подмешивается и снимаемый ребёнок «возвращается».
   */
  const skipChildrenUrlImportOnceRef = useRef(false);

  const allowedChildSet = useMemo(
    () => new Set(availableChildren.map((c) => c.id)),
    [availableChildren],
  );

  /** Стабильная строка для deps (нельзя класть в deps «рваный» набор полей familySync — React ругается на смену длины массива deps между рендерами). */
  const familySelectedPersonaIdsKey = useMemo(
    () => (familySync?.selectedPersonaIds ?? []).slice().sort().join(","),
    [familySync?.selectedPersonaIds],
  );

  const selectedChildrenIds = useMemo(() => {
    if (availableChildren.length === 0) return [];

    const useFamily =
      familySync &&
      !familySync.loading &&
      familySync.primaryAdultPersonaId;

    if (useFamily) {
      return familySync.selectedPersonaIds.filter((id) =>
        allowedChildSet.has(id),
      );
    }

    const raw = searchParams.get("children");
    if (!raw || raw === "all") return availableChildren.map((c) => c.id);
    const parsed = raw.split(",").filter((id) => allowedChildSet.has(id));
    return parsed.length > 0 ? parsed : availableChildren.map((c) => c.id);
  }, [availableChildren, allowedChildSet, searchParams, familySync]);

  const setSelectedChildrenIds = useCallback(
    (
      nextIds: string[],
      opts?: { adultIncluded?: boolean },
    ) => {
      const sanitized = nextIds.filter((id) => allowedChildSet.has(id));
      const allChildIds = availableChildren.map((c) => c.id);

      if (
        familySync &&
        !familySync.loading &&
        familySync.primaryAdultPersonaId
      ) {
        const adultId = familySync.primaryAdultPersonaId;
        const adultIncluded =
          opts?.adultIncluded !== undefined
            ? opts.adultIncluded
            : familySync.selectedPersonaIds.includes(adultId);
        const maxKids = adultIncluded
          ? Math.max(0, MAX_ACTIVE_FAMILY_PERSONAS - 1)
          : MAX_ACTIVE_FAMILY_PERSONAS;
        const nextChildSelection = sanitized.slice(0, maxKids);
        const personaIds = [
          ...(adultIncluded ? [adultId] : []),
          ...nextChildSelection,
        ];
        familySync.setSelectedPersonaIds(personaIds);

        const nextParams = new URLSearchParams(searchParams.toString());
        if (
          nextChildSelection.length === 0 ||
          nextChildSelection.length === allChildIds.length
        ) {
          nextParams.delete("children");
        } else {
          nextParams.set("children", nextChildSelection.join(","));
        }
        const childRanges = deriveAgeRangesFromChildren(
          availableChildren,
          nextChildSelection,
        );
        setAppliedAgeRanges(childRanges.map((r) => r.range));
        const query = nextParams.toString();
        skipChildrenUrlImportOnceRef.current = true;
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        return;
      }

      const nextChildSelection =
        sanitized.length === 0 || sanitized.length === allChildIds.length
          ? allChildIds
          : sanitized;

      const nextParams = new URLSearchParams(searchParams.toString());
      if (nextChildSelection.length === 0 || nextChildSelection.length === allChildIds.length) {
        nextParams.delete("children");
      } else {
        nextParams.set("children", nextChildSelection.join(","));
      }

      const childRanges = deriveAgeRangesFromChildren(availableChildren, nextChildSelection);
      setAppliedAgeRanges(childRanges.map((r) => r.range));

      const query = nextParams.toString();
      skipChildrenUrlImportOnceRef.current = true;
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [
      allowedChildSet,
      availableChildren,
      familySync?.loading,
      familySync?.primaryAdultPersonaId,
      familySelectedPersonaIdsKey,
      familySync?.setSelectedPersonaIds,
      pathname,
      router,
      searchParams,
      setAppliedAgeRanges,
    ],
  );

  /** Синхронизация ?children= при изменении selectedPersonaIds без вызова setSelectedChildrenIds. */
  useEffect(() => {
    if (!familySync || familySync.loading || !familySync.primaryAdultPersonaId) return;
    if (availableChildren.length === 0) return;
    const childPart = familySync.selectedPersonaIds.filter((id) =>
      allowedChildSet.has(id),
    );
    const allChildIds = availableChildren.map((c) => c.id);
    const nextParams = new URLSearchParams(searchParams.toString());
    if (childPart.length === 0 || childPart.length === allChildIds.length) {
      nextParams.delete("children");
    } else {
      nextParams.set("children", childPart.join(","));
    }
    const query = nextParams.toString();
    const nextHref = query ? `${pathname}?${query}` : pathname;
    const curHref =
      searchParams.toString().length > 0
        ? `${pathname}?${searchParams.toString()}`
        : pathname;
    if (nextHref === curHref) return;
    skipChildrenUrlImportOnceRef.current = true;
    router.replace(nextHref, { scroll: false });
  }, [
    allowedChildSet,
    availableChildren,
    familySync?.loading,
    familySync?.primaryAdultPersonaId,
    familySelectedPersonaIdsKey,
    familySync?.setSelectedPersonaIds,
    pathname,
    router,
    searchParams,
  ]);

  /** Шаринг ссылки с ?children= — подмешиваем в глобальный выбор персон (только при смене URL, не при смене семьи). */
  useEffect(() => {
    if (skipChildrenUrlImportOnceRef.current) {
      skipChildrenUrlImportOnceRef.current = false;
      return;
    }
    if (!familySync || familySync.loading || !familySync.primaryAdultPersonaId) return;
    if (availableChildren.length === 0) return;
    const raw = searchParams.get("children");
    if (!raw || raw === "all") return;
    const parsed = raw.split(",").filter((id) => allowedChildSet.has(id));
    if (parsed.length === 0) return;
    const sorted = (a: string[]) => [...a].sort().join(",");
    const currentChildIds = familySync.selectedPersonaIds.filter((id) =>
      allowedChildSet.has(id),
    );
    if (sorted(parsed) === sorted(currentChildIds)) return;
    const adultId = familySync.primaryAdultPersonaId;
    if (!adultId) return;
    const maxKidsWithAdult = MAX_ACTIVE_FAMILY_PERSONAS - 1;
    const capped = parsed.slice(0, maxKidsWithAdult);
    familySync.setSelectedPersonaIds([adultId, ...capped]);
  }, [
    allowedChildSet,
    availableChildren.length,
    familySync?.loading,
    familySync?.primaryAdultPersonaId,
    familySync?.setSelectedPersonaIds,
    searchParams,
  ]);

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

  const freeWhoMode =
    !!familySync &&
    !familySync.loading &&
    !!familySync.primaryAdultPersonaId &&
    familySync.selectedPersonaIds.length === 0;

  const autoAgeValues = useMemo(() => {
    const fromChildren = childDerivedRanges.map((r) => r.range);
    const adultId = familySync?.primaryAdultPersonaId;
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
    familySync?.loading,
    familySync?.primaryAdultPersonaId,
    familySelectedPersonaIdsKey,
  ]);

  return {
    citySlug,
    selectedChildrenIds,
    setSelectedChildrenIds,
    selectedAgeRanges,
    setSelectedAgeRanges,
    childrenLabel: buildChildrenLabel(availableChildren, selectedChildrenIds, {
      freeWhoMode,
    }),
    autoAgeValues,
  };
}
