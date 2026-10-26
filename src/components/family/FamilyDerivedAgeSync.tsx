"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
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

  // Only URL navigation/hydration may restore a persona from the URL.
  // A user selecting family members elsewhere in the app must not be undone
  // merely because the FamilyPersonaContext updated before its URL write.
  const lastUrlRef = useRef<string | null>(null);
  const awaitingUrlHydrationRef = useRef(false);
  const urlSignature = `${pathname}?${searchParams.toString()}`;
  useEffect(() => {
    if (!inCityDiscoveryContext || !isAuthenticated || !family || family.loading) return;
    if (lastUrlRef.current === urlSignature) return;
    lastUrlRef.current = urlSignature;

    const selectedFromUrl = (searchParams.get("profile") ?? "")
      .split(",")
      .filter(id => family.personas.some(persona => persona.id === id));
    const selectedCurrent = family.selectedPersonaIds;
    if (searchParams.has("profile") && selectedFromUrl.length > 0) {
      if (selectedFromUrl.slice().sort().join(",") !== selectedCurrent.slice().sort().join(",")) {
        awaitingUrlHydrationRef.current = true;
        family.setSelectedPersonaIds(selectedFromUrl);
      }
    } else if (searchParams.has("age") && !searchParams.has("profile") && selectedCurrent.length > 0) {
      awaitingUrlHydrationRef.current = true;
      family.setSelectedPersonaIds([]);
    }
  }, [inCityDiscoveryContext, isAuthenticated, family, family?.loading, urlSignature, searchParams]);

  useEffect(() => {
    if (!inCityDiscoveryContext) return;
    if (!isAuthenticated || !family || family.loading) return;

    if (awaitingUrlHydrationRef.current) {
      const desired = (searchParams.get("profile") ?? "").split(",").filter(Boolean).sort().join(",");
      const actual = family.selectedPersonaIds.slice().sort().join(",");
      const hydrated = desired === actual || (!desired && actual === "");
      if (!hydrated) return;
      awaitingUrlHydrationRef.current = false;
    }

    /** Свободный поиск: a context change must clear a stale profile in URL. */
    if (family.selectedPersonaIds.length === 0) {
      if (applied.profile || applied.adultOnly) {
        actions.setDraft({ profile: null, age: applied.profile ? [] : applied.age, adultOnly: false });
      }
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
        !applied.adultOnly && applied.profile === family.selectedPersonaIds.join(",")
      ) {
        return;
      }

      actions.setDraft({ age: sortedTarget, profile: family.selectedPersonaIds.join(","), adultOnly: false });
      return;
    }

    /** Только взрослый в выборе: это сценарий «Я / без детей», а не strict ADULT_ONLY. */
    const adultSelected =
      !!adultId && family.selectedPersonaIds.includes(adultId);

    if (adultSelected) {
      const current = applied.age ?? [];
      const alreadySelfContext =
        current.length === 1 && current[0] === "18+" && !applied.adultOnly &&
        applied.profile === family.selectedPersonaIds.join(",");
      if (!alreadySelfContext) {
        actions.setDraft({ age: ["18+"], profile: family.selectedPersonaIds.join(","), adultOnly: false });
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
    applied.profile,
    applied.adultOnly,
    searchParams,
    actions,
  ]);

  return null;
}
