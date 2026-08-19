import { MAX_SELECTED_AGE_RANGES } from "./resolveDefaultParticipants";

/**
 * Тоггл выбора диапазона возраста в шаге needs-age (до MAX_SELECTED_AGE_RANGES одновременно).
 * Уже выбранный диапазон снимается; при превышении лимита самый старый выбор вытесняется (FIFO),
 * а не блокируется молча.
 */
export function toggleAgeRangeSelection(selected: string[], value: string): string[] {
  if (selected.includes(value)) {
    return selected.filter((v) => v !== value);
  }
  if (selected.length < MAX_SELECTED_AGE_RANGES) {
    return [...selected, value];
  }
  return [...selected.slice(1), value];
}
