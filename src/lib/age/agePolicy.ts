import { AgePolicy } from "@prisma/client";
import { isValidAgeKey, sortAgeKeys } from "@/lib/config/ages";

export type AgePolicyInput = {
  agePolicy: AgePolicy;
  ageTags?: readonly string[] | null;
  ageMinMonths?: number | null;
  ageMaxMonths?: number | null;
};

export type NormalizedAgePolicy = {
  agePolicy: AgePolicy;
  ageTags: string[];
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
};

/**
 * Canonical write-boundary rule: contradictory states are rejected, not
 * silently reinterpreted. Policy transitions clear incompatible data in the
 * editor helper below before reaching this validator.
 */
export function normalizeAgePolicy(input: AgePolicyInput): NormalizedAgePolicy {
  const ageTags = sortAgeKeys(
    Array.from(new Set(input.ageTags ?? [])).filter(isValidAgeKey),
  );
  if (ageTags.length !== (input.ageTags?.length ?? 0)) {
    throw new Error("INVALID_AGE_TAGS");
  }

  const ageMinMonths = input.ageMinMonths ?? null;
  const ageMaxMonths = input.ageMaxMonths ?? null;
  if (ageMinMonths != null && (!Number.isInteger(ageMinMonths) || ageMinMonths < 0)) {
    throw new Error("INVALID_AGE_MIN");
  }
  if (ageMaxMonths != null && (!Number.isInteger(ageMaxMonths) || ageMaxMonths < 0)) {
    throw new Error("INVALID_AGE_MAX");
  }
  if (ageMinMonths != null && ageMaxMonths != null && ageMinMonths > ageMaxMonths) {
    throw new Error("INVALID_AGE_RANGE");
  }

  if (input.agePolicy === AgePolicy.SPECIFIC) {
    if (ageTags.length === 0 && ageMinMonths == null && ageMaxMonths == null) {
      throw new Error("SPECIFIC_AGE_REQUIRED");
    }
    return { agePolicy: input.agePolicy, ageTags, ageMinMonths, ageMaxMonths };
  }

  if (ageTags.length > 0 || ageMinMonths != null || ageMaxMonths != null) {
    throw new Error("AGE_POLICY_CONTRADICTION");
  }
  return { agePolicy: input.agePolicy, ageTags: [], ageMinMonths: null, ageMaxMonths: null };
}

export type EditorAgeState = Pick<NormalizedAgePolicy, "agePolicy" | "ageTags">;

export function selectUnrestrictedAge(): EditorAgeState {
  return { agePolicy: AgePolicy.UNRESTRICTED, ageTags: [] };
}

export function selectAdultOnlyAge(): EditorAgeState {
  return { agePolicy: AgePolicy.ADULT_ONLY, ageTags: [] };
}

export function selectSpecificAge(ageTags: readonly string[]): EditorAgeState {
  const normalized = normalizeAgePolicy({ agePolicy: AgePolicy.SPECIFIC, ageTags });
  return { agePolicy: normalized.agePolicy, ageTags: normalized.ageTags };
}

export function agePolicyLabel(policy: AgePolicy): string {
  if (policy === AgePolicy.ADULT_ONLY) return "Только 18+";
  if (policy === AgePolicy.UNRESTRICTED) return "Любой возраст";
  if (policy === AgePolicy.UNKNOWN) return "Возраст не указан";
  return "Конкретный возраст";
}

export function compactAgePolicyLabel(policy: AgePolicy): string | null {
  return policy === AgePolicy.ADULT_ONLY ? "18+" : null;
}
