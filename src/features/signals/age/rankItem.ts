import type { AgeScoreLike } from "./getAgeScore";
import { getAgeScore } from "./getAgeScore";

/** Content that can be ranked by age (places, events, offers). */
export type RankableByAge = {
  ageOptions: AgeScoreLike[];
};

/**
 * Max age affinity score for an item vs user's age.
 * Uses the best matching option when an item spans several age bands.
 */
export function rankItem(userAge: number, item: RankableByAge): number {
  if (!item.ageOptions?.length) {
    return 0;
  }
  return Math.max(0, ...item.ageOptions.map((opt) => getAgeScore(userAge, opt)));
}
