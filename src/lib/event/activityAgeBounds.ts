/**
 * Единая логика границ возраста для события (лента «Куда пойти», карточки, публичная страница).
 *
 * Месяцы учитываем только если заданы **оба** — иначе опираемся на ключи `ageTags` из админки
 * (`0-1`, `3-5`, …), как в {@link formatAgeKeysShort}.
 */
export function ageBoundsFromActivityFields(a: {
  ageTags: string[];
  ageMinMonths: number | null | undefined;
  ageMaxMonths: number | null | undefined;
}): { ageFrom: number; ageTo: number } {
  if (
    a.ageMinMonths != null &&
    a.ageMaxMonths != null &&
    Number.isFinite(a.ageMinMonths) &&
    Number.isFinite(a.ageMaxMonths)
  ) {
    return {
      ageFrom: Math.max(0, Math.floor(a.ageMinMonths / 12)),
      ageTo: Math.min(99, Math.ceil(a.ageMaxMonths / 12)),
    };
  }
  for (const tag of a.ageTags) {
    const m = tag.match(/^(\d+)\s*[-–]\s*(\d+)/);
    if (m) {
      return { ageFrom: parseInt(m[1]!, 10), ageTo: parseInt(m[2]!, 10) };
    }
    const plus = tag.match(/^(\d+)\s*\+/);
    if (plus) {
      const y = parseInt(plus[1]!, 10);
      return { ageFrom: y, ageTo: 99 };
    }
  }
  return { ageFrom: 0, ageTo: 12 };
}

/** Подпись как в мета-строке карточки в ленте: «0+», «3+». */
export function ageFromPlusLabelFromBounds(ageFrom: number): string {
  return `${ageFrom}+`;
}
