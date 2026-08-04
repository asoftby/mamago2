"use client";

import { useMemo } from "react";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { readLastPlanParticipants } from "./lastPlanParticipantsStorage";
import {
  resolveDefaultParticipants,
  type ResolveDefaultParticipantsResult,
} from "./resolveDefaultParticipants";

/**
 * Вызывать только когда `family.loading === false` — до загрузки профиля
 * `personas`/`primaryAdultPersonaId` ещё не отражают реальный состав семьи.
 * Без `FamilyPersonaProvider` в дереве (не должно происходить в «Мой план»,
 * но контекст всюду читается как nullable) деградирует к `needs-age`.
 */
export function useResolveDefaultParticipants(): ResolveDefaultParticipantsResult {
  const family = useFamilyPersona();
  return useMemo(
    () =>
      resolveDefaultParticipants({
        lastUsedPersonaIds: readLastPlanParticipants(),
        personas: family?.personas ?? [],
        primaryAdultPersonaId: family?.primaryAdultPersonaId ?? null,
      }),
    [family?.personas, family?.primaryAdultPersonaId],
  );
}
