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

/**
 * Минимальный нижний предел по всем диапазонам в `ageTags` (`5-7`, `12+`, …) — для бэйджа на странице события.
 */
export function ageFromPlusBadgeFromAgeTags(ageTags: string[]): string | undefined {
  let minLo: number | null = null;
  for (const tag of ageTags) {
    const t = tag.trim();
    const range = t.match(/^(\d+)\s*[-–]\s*(\d+)/);
    if (range) {
      const lo = Number.parseInt(range[1]!, 10);
      if (Number.isFinite(lo)) {
        minLo = minLo === null ? lo : Math.min(minLo, lo);
      }
      continue;
    }
    const plus = t.match(/^(\d+)\s*\+/);
    if (plus) {
      const y = Number.parseInt(plus[1]!, 10);
      if (Number.isFinite(y)) {
        minLo = minLo === null ? y : Math.min(minLo, y);
      }
    }
  }
  if (minLo === null) return undefined;
  return ageFromPlusLabelFromBounds(minLo);
}
