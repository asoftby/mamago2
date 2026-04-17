"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { deriveAgeRangesFromChildren } from "@/features/filters/discovery/childrenScope.store";
import { getCityFromPath } from "@/lib/intent";

/**
 * Единая точка: при выбранных детях — возраст производный от дат рождения; если в выборе ещё взрослый — в URL добавляется 18+;
 * Сброс «Для всех» по клику очищает возраст в URL; дальше пользователь может выбрать возраст вручную.
 * Работает на всех маршрутах (в т.ч. мобильный хедер без DesktopSearchControl).
 */
export function FamilyDerivedAgeSync() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuthMe();
  const family = useFamilyPersona();
  const { applied, actions } = useDiscoveryFilters();
  /** Был ли в выборе хотя бы один ребёнок (для перехода «сняли детей → остался взрослый» → 18+). */
  const prevHadChildInSelectionRef = useRef(false);

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
    if (!isAuthenticated || !family || family.loading) {
      return;
    }
    /** «Для всех»: персон нет — синк по персонам не трогаем возраст (сброс возраста — в обработчике таба). */
    if (family.selectedPersonaIds.length === 0) {
      prevHadChildInSelectionRef.current = false;
      return;
    }

    const adultId = family.primaryAdultPersonaId;
    const childIds =
      profileChildren.length > 0
        ? family.selectedPersonaIds.filter((id) =>
            profileChildren.some((c) => c.id === id),
          )
        : [];

    if (childIds.length > 0) {
      const fromKids = deriveAgeRangesFromChildren(profileChildren, childIds).map((r) => r.range);
      const adultInSelection =
        !!adultId && family.selectedPersonaIds.includes(adultId);
      const merged = adultInSelection && !fromKids.includes("18+") 
        ? [...fromKids, "18+"]
        : fromKids;
      const sortedTarget = merged.slice().sort();
      const cur = applied.age ?? [];
      if (cur.slice().sort().join(",") === sortedTarget.join(",")) {
        prevHadChildInSelectionRef.current = true;
        return;
      }
      actions.setDraft({ age: sortedTarget });
      prevHadChildInSelectionRef.current = true;
      return;
    }

    /** Только взрослый в выборе — по умолчанию возраст 18+ */
    const adultOnly =
      !!adultId &&
      family.selectedPersonaIds.length > 0 &&
      family.selectedPersonaIds.includes(adultId);

    if (!adultOnly) {
      prevHadChildInSelectionRef.current = false;
      return;
    }

    const cur = applied.age ?? [];
    const want18 = ["18+"];
    if (cur.slice().sort().join(",") === want18.slice().sort().join(",")) {
      prevHadChildInSelectionRef.current = false;
      return;
    }

    const emptyAge = cur.length === 0;
    const transitionedFromChild = prevHadChildInSelectionRef.current === true;
    /** «Залипший» детский диапазон при выборе только взрослого; 16–18 оставляем (подросток). */
    const staleChildAgeWhileAdultOnly =
      cur.length > 0 && cur.some((v) => v !== "18+" && v !== "16-18");

    if (emptyAge || transitionedFromChild || staleChildAgeWhileAdultOnly) {
      actions.setDraft({ age: want18 });
    }
    prevHadChildInSelectionRef.current = false;
  }, [
    inCityDiscoveryContext,
    isAuthenticated,
    family,
    family?.selectedPersonaIds,
    family?.loading,
    profileChildren,
    applied.age,
    actions,
  ]);

  return null;
}
