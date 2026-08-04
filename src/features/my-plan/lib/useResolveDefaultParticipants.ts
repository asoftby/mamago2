"use client";

import { useMemo } from "react";
import { useFamilyPersonaRequired } from "@/contexts/FamilyPersonaContext";
import { readLastPlanParticipants } from "./lastPlanParticipantsStorage";
import {
  resolveDefaultParticipants,
  type ResolveDefaultParticipantsResult,
} from "./resolveDefaultParticipants";

/**
 * Вызывать только когда `family.loading === false` — до загрузки профиля
 * `personas`/`primaryAdultPersonaId` ещё не отражают реальный состав семьи.
 */
export function useResolveDefaultParticipants(): ResolveDefaultParticipantsResult {
  const family = useFamilyPersonaRequired();
  return useMemo(
    () =>
      resolveDefaultParticipants({
        lastUsedPersonaIds: readLastPlanParticipants(),
        personas: family.personas,
        primaryAdultPersonaId: family.primaryAdultPersonaId,
      }),
    [family.personas, family.primaryAdultPersonaId],
  );
}
