/** Wishlist (PR 1): pure view helpers for the author UI. */

export type OwnerItemState = "FREE" | "PARTIAL" | "RESERVED" | "PURCHASED";

const ERRORS: Record<string, string> = {
  not_found: "Список не найден.",
  invalid_input: "Проверьте введённые данные.",
  invalid_recipient: "Этого ребёнка нет в вашей семье.",
  archived: "Список в архиве. Верните его из архива, чтобы редактировать.",
  item_reserved: "Подарок уже забронирован.",
  disabled: "Раздел пока недоступен.",
  sold_out: "Этот подарок только что забронировали. Выберите другой.",
  forbidden: "Это не ваша бронь.",
  rate_limited: "Слишком много попыток. Попробуйте позже.",
};

export function wishlistErrorMessage(code: string | undefined | null): string {
  return (code && ERRORS[code]) || "Не получилось. Попробуйте ещё раз.";
}

export function itemStateLabel(state: OwnerItemState, taken: number, quantity: number): string | null {
  switch (state) {
    case "FREE":
      return null;
    case "PARTIAL":
      return `Занято ${taken} из ${quantity}`;
    case "RESERVED":
      return "Забронирован";
    case "PURCHASED":
      return "Куплен";
  }
}

/**
 * Parses a "title + link or comment" line. A bare http(s) URL token becomes
 * the link, the rest of the text is the title; a line that is only a URL keeps
 * the hostname as a provisional title.
 */
export function parseQuickLine(raw: string): { title: string; url: string | null } {
  const text = raw.trim();
  const match = text.match(/https?:\/\/\S+/i);
  if (!match) return { title: text, url: null };
  const url = match[0].replace(/[),.;]+$/, "");
  const title = text.replace(match[0], "").replace(/\s{2,}/g, " ").trim();
  if (title) return { title, url };
  try {
    return { title: new URL(url).hostname.replace(/^www\./, ""), url };
  } catch {
    return { title: text, url: null };
  }
}

export function formatEventDate(dateKey: string | null): string | null {
  if (!dateKey) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
