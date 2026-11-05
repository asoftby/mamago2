/** Shared user-facing family suitability badge copy, independent of the ranking algorithm. */
export function childNameDative(raw: string): string | null {
  const name = raw.trim();
  if (!/^[А-ЯЁа-яё-]+$/u.test(name)) return null;
  if (/ия$/iu.test(name)) return name.slice(0, -1) + "и";
  if (/[ая]$/iu.test(name)) return name.slice(0, -1) + "е";
  if (/[йь]$/iu.test(name)) return name.slice(0, -1) + "ю";
  if (/[бвгджзклмнпрстфхцчшщ]$/iu.test(name)) return name + "у";
  return null;
}

export function familyFitBadgeLabel(input: {
  matchedChildNames?: readonly string[];
  allChildrenMatch?: boolean;
  allowsAdults?: boolean;
  adultOnly?: boolean;
}): string | null {
  if (input.adultOnly) return "Подходит Вам";
  const names = (input.matchedChildNames ?? []).map((name) => name.trim()).filter(Boolean);
  if (!names.length) return input.allowsAdults ? "Подходит Вам" : null;
  const dative = names.map(childNameDative);
  const children = dative.some((name) => !name)
    ? [names.length === 1 ? "ребёнку" : "детям"]
    : dative as string[];
  const people = input.allowsAdults ? ["Вам", ...children] : children;
  return "Подходит " + (people.length === 2 ? people.join(" и ") : people.join(", "));
}
