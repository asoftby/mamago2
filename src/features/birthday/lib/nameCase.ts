/**
 * Падежи имён для персонализации (эвристики для типичных русских имён).
 * Полная морфология не гарантируется — для редких имён возможен возврат в исходной форме.
 */
export type RussianNameCase =
  | "nominative"
  | "dative"
  | "genitive"
  | "accusative"
  | "instrumental"
  | "prepositional";

function matchCapitalization(original: string, result: string): string {
  if (!original.length || !result.length) return result;
  const firstOrig = original[0];
  if (firstOrig === firstOrig.toUpperCase() && firstOrig !== firstOrig.toLowerCase()) {
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}

/** Дательный падеж: Степану, Ане, Марии, Алексею… */
function toDative(name: string): string {
  const n = name.trim();
  if (!n) return n;
  const lower = n.toLowerCase();
  const orig = n;

  // Мария, Виктория → Марии
  if (lower.endsWith("ия")) {
    return matchCapitalization(orig, n.slice(0, -1) + "и");
  }
  // Илья → Илье
  if (lower.endsWith("ья")) {
    return matchCapitalization(orig, n.slice(0, -2) + "ье");
  }
  // Евгений, Василий → Евгению
  if (lower.endsWith("ий")) {
    return matchCapitalization(orig, n.slice(0, -2) + "ию");
  }
  // Алексей, Андрей, Алексей → Алексею, Андрею
  if (lower.endsWith("ей")) {
    return matchCapitalization(orig, n.slice(0, -2) + "ею");
  }
  // Николай, Виталий → Николаю (ай → аю; ий уже выше)
  if (lower.endsWith("ай")) {
    return matchCapitalization(orig, n.slice(0, -2) + "аю");
  }
  // Анна, Маша → Анне, Маше
  if (lower.endsWith("а")) {
    return matchCapitalization(orig, n.slice(0, -1) + "е");
  }
  // Аня, Катя, Зоя → Ане, Кате, Зое
  if (lower.endsWith("я")) {
    return matchCapitalization(orig, n.slice(0, -1) + "е");
  }
  // Любовь → Любови
  if (lower.endsWith("ь")) {
    return matchCapitalization(orig, n.slice(0, -1) + "и");
  }
  // Редкий остаточный й (если не попал в ей/ий/ай)
  if (lower.endsWith("й")) {
    return matchCapitalization(orig, n.slice(0, -1) + "ю");
  }
  // Иван, Степан, Артём → Ивану, Степану, Артёму
  if (/[бвгджзйклмнпрстфхцчшщ]$/i.test(lower)) {
    return matchCapitalization(orig, n + "у");
  }
  return n;
}

/**
 * @param name — имя (лучше одно слово)
 * @param grammaticalCase — целевой падеж
 */
export function getNameCase(name: string, grammaticalCase: RussianNameCase): string {
  const trimmed = name.trim();
  if (!trimmed) return "";

  switch (grammaticalCase) {
    case "nominative":
      return trimmed;
    case "dative":
      return toDative(trimmed);
    case "genitive":
    case "accusative":
    case "instrumental":
    case "prepositional":
      // при необходимости расширить отдельными правилами
      return trimmed;
    default:
      return trimmed;
  }
}
