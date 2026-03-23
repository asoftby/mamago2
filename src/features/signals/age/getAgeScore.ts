import type { AgeOption } from "@/lib/config/ages";

/** Canonical age option, taxonomy signal row, or any object with bounds + optional weight */
export type AgeScoreLike = Pick<AgeOption, "minAge" | "maxAge"> & { weight?: number };

/**
 * Score how well `userAge` (whole years) matches an age option.
 * - Inside [minAge, maxAge] → 1 × weight
 * - Exactly ±1 year from the nearest interval edge → 0.5 × weight
 * - Otherwise → 0
 */
export function getAgeScore(userAge: number, option: AgeScoreLike): number {
  const w = option.weight ?? 1;
  const min = option.minAge;
  const max = option.maxAge;

  if (userAge >= min && userAge <= max) {
    return 1 * w;
  }

  let dist = 0;
  if (userAge < min) {
    dist = min - userAge;
  } else {
    dist = userAge - max;
  }

  if (dist === 1) {
    return 0.5 * w;
  }

  return 0;
}
