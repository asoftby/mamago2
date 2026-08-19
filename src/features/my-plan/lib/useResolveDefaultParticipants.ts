"use client";

import { useMemo } from "react";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { readLastPlanParticipants } from "./lastPlanParticipantsStorage";
import { readLastPlanAgeRanges } from "./lastPlanAgeRangesStorage";
import {
  resolveDefaultParticipants,
  type ResolveDefaultParticipantsResult,
} from "./resolveDefaultParticipants";

/**
 * Вызывать только когда `family.loading === false` — до загрузки профиля
 * `personas`/`primaryAdultPersonaId` ещё не отражают реальный состав семьи.
 * Без `FamilyPersonaProvider` в дереве (не должно происходить в «Мой план»,
 * но контекст всюду читается как nullable) деградирует к `needs-age`.
 *
 * localStorage читается один раз при вычислении (mount / смена personas) — этого
 * достаточно, потому что модалка «Мой план» размонтирует контент при закрытии
 * (ResponsiveOverlay/Radix), так что повторное открытие пересчитывает хук заново
 * и подхватывает то, что было записано ответом на шаг needs-age в предыдущий раз.
 */
export function useResolveDefaultParticipants(): ResolveDefaultParticipantsResult {
  const family = useFamilyPersona();
  return useMemo(
    () =>
      resolveDefaultParticipants({
        lastUsedPersonaIds: readLastPlanParticipants(),
        lastUsedAgeRanges: readLastPlanAgeRanges(),
        personas: family?.personas ?? [],
        primaryAdultPersonaId: family?.primaryAdultPersonaId ?? null,
      }),
    [family?.personas, family?.primaryAdultPersonaId],
  );
}
