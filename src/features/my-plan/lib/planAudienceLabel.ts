/** «Я» в подписи аудитории читается как «меня» («Для меня»). */
export const PLAN_SELF_LABEL = "Я";

export function toGenitiveName(name: string): string {
  const n = name.trim();
  if (!n) return name;
  const lower = n.toLowerCase();
  if (lower.endsWith("а")) {
    const base = n.slice(0, -1);
    const prev = base.slice(-1).toLowerCase();
    const ending = ["г", "к", "х", "ж", "ч", "ш", "щ"].includes(prev) ? "и" : "ы";
    return `${base}${ending}`;
  }
  if (lower.endsWith("я")) return `${n.slice(0, -1)}и`;
  if (lower.endsWith("й") || lower.endsWith("ь")) return `${n.slice(0, -1)}я`;
  return `${n}а`;
}

/**
 * Подпись справа от заголовка дня: «Для всех» без фильтра, «Для меня» / «Для Степана»,
 * если выбран один человек, иначе «Для выбранных». Так же, как в виджете «Мой план».
 */
export function planAudienceLabel(includedNames: readonly string[], hasExclusions: boolean): string {
  if (includedNames.length === 0 && !hasExclusions) return "Для всех";
  if (includedNames.length === 1 && !hasExclusions) {
    const [name] = includedNames;
    return `Для ${name === PLAN_SELF_LABEL ? "меня" : toGenitiveName(name!)}`;
  }
  return "Для выбранных";
}
