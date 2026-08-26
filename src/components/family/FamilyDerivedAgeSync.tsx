"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { deriveAgeRangesFromChildren } from "@/features/filters/discovery/childrenScope.store";
import { getCityFromPath } from "@/lib/intent";

/**
 * Единая точка синхронизации глобального «Для кого» с discovery URL.
 * Выбранные персоны всегда сильнее старого secondary-фильтра adultOnly:
 * «Я» = 18+, дети = производные возрастные диапазоны, пустой выбор =
 * свободный поиск. Это не strict `agePolicy=ADULT_ONLY`.
 */
export function FamilyDerivedAgeSync() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuthMe();
  const family = useFamilyPersona();
  const { applied, actions } = useDiscoveryFilters();

  /** Не трогаем URL вне города/«Мой план» (админ, API и т.д.). */
  const inCityDiscoveryContext =
    getCityFromPath(pathname) != null ||
    pathname === "/me" ||
    pathname.startsWith("/me/");

  const profileChildren = useMemo(
    () =>
      isAuthenticated && family && !family.loading
        ? family.childPersonasForFilter
        : [],
    [isAuthenticated, family, family?.loading],
  );

  useEffect(() => {
    if (!inCityDiscoveryContext) return;
    if (!isAuthenticated || !family || family.loading) return;

    /** Свободный поиск: глобальный выбор персон пуст. Legacy #nokids не должен залипать. */
    if (family.selectedPersonaIds.length === 0) {
      if (applied.adultOnly) actions.setDraft({ adultOnly: false });
      return;
    }

    const adultId = family.primaryAdultPersonaId;
    const childIds =
      profileChildren.length > 0
        ? family.selectedPersonaIds.filter((id) =>
            profileChildren.some((child) => child.id === id),
          )
        : [];

    if (childIds.length > 0) {
      const fromKids = deriveAgeRangesFromChildren(profileChildren, childIds).map((range) => range.range);
      const adultInSelection =
        !!adultId && family.selectedPersonaIds.includes(adultId);
      const merged = adultInSelection && !fromKids.includes("18+")
        ? [...fromKids, "18+"]
        : fromKids;
      const sortedTarget = merged.slice().sort();
      const sortedCurrent = (applied.age ?? []).slice().sort();

      if (
        sortedCurrent.join(",") === sortedTarget.join(",") &&
        !applied.adultOnly
      ) {
        return;
      }

      actions.setDraft({ age: sortedTarget, adultOnly: false });
      return;
    }

    /** Только взрослый в выборе: это сценарий «Я / без детей», а не strict ADULT_ONLY. */
    const adultSelected =
      !!adultId && family.selectedPersonaIds.includes(adultId);

    if (adultSelected) {
      const current = applied.age ?? [];
      const alreadySelfContext =
        current.length === 1 && current[0] === "18+" && !applied.adultOnly;
      if (!alreadySelfContext) {
        actions.setDraft({ age: ["18+"], adultOnly: false });
      }
      return;
    }

    if (applied.adultOnly) actions.setDraft({ adultOnly: false });
  }, [
    inCityDiscoveryContext,
    isAuthenticated,
    family,
    family?.selectedPersonaIds,
    family?.loading,
    profileChildren,
    applied.age,
    applied.adultOnly,
    actions,
  ]);

  return null;
}
