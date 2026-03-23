/**
 * Родительный падеж русского имени после предлога «для» («для кого?»).
 * Эвристика: покрывает типичные окончания; редкие имена могут потребовать словаря.
 */

function capitalizeLike(original: string, declinedLower: string): string {
  if (!declinedLower.length) return declinedLower;
  const o0 = original[0];
  if (o0 !== undefined && o0 === o0.toUpperCase() && o0 !== o0.toLowerCase()) {
    return declinedLower.charAt(0).toUpperCase() + declinedLower.slice(1);
  }
  return declinedLower;
}

/** Берём первое слово (имя), если ввели «Иван Петров». */
function firstToken(name: string): string {
  const t = name.trim();
  if (!t) return "";
  return t.split(/\s+/)[0] ?? "";
}

/**
 * Имя в родительном падеже для конструкции «для {имя}».
 * Например: Степан → Степана, Мария → Марии, Миша → Миши.
 */
export function firstNameGenitiveForDlya(name: string): string {
  const first = firstToken(name);
  if (!first) return "";

  const lower = first.toLowerCase();

  /** Исключения, где простые правила дают неверный результат */
  const SPECIAL: Record<string, string> = {
    лев: "льва",
    павел: "павла",
    пётр: "петра",
    петр: "петра",
  };

  if (SPECIAL[lower]) {
    return capitalizeLike(first, SPECIAL[lower]);
  }

  // Василий, Евгений → Василия, Евгения
  if (lower.endsWith("ий")) {
    return capitalizeLike(first, lower.slice(0, -2) + "ия");
  }
  // Андрей, Алексей → Андрея, Алексея
  if (lower.endsWith("й")) {
    return capitalizeLike(first, lower.slice(0, -1) + "я");
  }
  // Игорь → Игоря; Любовь → Любви (овь/евь)
  if (lower.endsWith("ь")) {
    if (lower.endsWith("овь") || lower.endsWith("евь")) {
      return capitalizeLike(first, lower.slice(0, -1) + "и");
    }
    return capitalizeLike(first, lower.slice(0, -1) + "я");
  }
  // Мария, София → Марии, Софии
  if (lower.endsWith("ия")) {
    return capitalizeLike(first, lower.slice(0, -2) + "ии");
  }
  // Дарья → Дарьи
  if (lower.endsWith("ья")) {
    return capitalizeLike(first, lower.slice(0, -2) + "ьи");
  }
  // Илья, Маша, Аня → Ильи, Маши, Ани
  if (lower.endsWith("я")) {
    return capitalizeLike(first, lower.slice(0, -1) + "и");
  }
  // Анна, Никита, Миша (ж/ч/ш/щ + а → …и)
  if (lower.endsWith("а")) {
    const before = lower[lower.length - 2];
    if (before && "жчшщц".includes(before)) {
      return capitalizeLike(first, lower.slice(0, -1) + "и");
    }
    return capitalizeLike(first, lower.slice(0, -1) + "ы");
  }
  // Иван, Степан → Ивана, Степана
  return capitalizeLike(first, lower + "а");
}
