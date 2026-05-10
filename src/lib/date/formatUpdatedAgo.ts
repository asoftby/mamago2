/**
 * Строка «Обновлено: …» для карточек публикаций в бизнес-кабинете.
 * Относительное время от текущего момента с русскими короткими формами.
 */

function ruPlural(
  n: number,
  forms: readonly [string, string, string],
): string {
  const nAbs = Math.floor(Math.abs(n)) % 100;
  const n1 = nAbs % 10;
  if (nAbs > 10 && nAbs < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

function toDate(value: Date | string): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Полная строка с префиксом «Обновлено: » или null, если дату показывать нельзя. */
export function formatUpdatedAgo(
  updatedAt?: Date | string | null,
  createdAt?: Date | string | null,
): string | null {
  const primary = updatedAt ?? createdAt;
  if (primary == null || primary === "") return null;
  const date = toDate(primary);
  if (!date) return null;

  const now = Date.now();
  let diffMs = now - date.getTime();
  if (diffMs < 0) diffMs = 0;

  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec <= 5) {
    return "Обновлено: только что";
  }
  if (diffSec < 60) {
    return `Обновлено: ${diffSec} сек. назад`;
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `Обновлено: ${diffMin} мин. назад`;
  }

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return `Обновлено: ${diffHour} ч. назад`;
  }

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 365) {
    const word = ruPlural(diffDay, ["день", "дня", "дней"]);
    return `Обновлено: ${diffDay} ${word} назад`;
  }

  const years = Math.max(1, Math.floor(diffDay / 365));
  const yWord = ruPlural(years, ["год", "года", "лет"]);
  return `Обновлено: ${years} ${yWord} назад`;
}
