// The range calendar persists YYYY-(zero-based month)-D keys, not ISO dates.
export function calendarDateKeyToIso(key: string | null): string | null {
  if (!key) return null;
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(key);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const monthIndex = Number(monthText);
  const day = Number(dayText);
  const valid = new Date(Date.UTC(year, monthIndex, day));
  if (valid.getUTCFullYear() !== year || valid.getUTCMonth() !== monthIndex ||
      valid.getUTCDate() !== day) return null;
  return yearText + "-" + String(monthIndex + 1).padStart(2, "0") + "-" +
    String(day).padStart(2, "0");
}

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month ||
      date.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** Full months of age on the party date; null when either date is missing, invalid or before birth. */
export function ageMonthsOnDate(
  birthDateIso: string | null | undefined, partyDateIso: string | null | undefined,
): number | null {
  if (!birthDateIso || !partyDateIso) return null;
  const birth = parseIsoDate(birthDateIso);
  const party = parseIsoDate(partyDateIso);
  if (!birth || !party) return null;
  const fullMonths = (party.year - birth.year) * 12 + (party.month - birth.month) -
    Number(party.day < birth.day);
  return fullMonths < 0 ? null : fullMonths;
}

/** Full years on the party date within the API range (0–20), otherwise null. */
export function childAgeYearsOnDate(
  birthDateIso: string | null | undefined, partyDateIso: string | null | undefined,
): number | null {
  const months = ageMonthsOnDate(birthDateIso, partyDateIso);
  if (months == null) return null;
  const years = Math.floor(months / 12);
  return years <= 20 ? years : null;
}

/** Catalogue context contains no child name, ID or date of birth. Bound to one party date. */
export type PartyRecipientContext = {
  name: boolean; age: boolean; ageMonths?: number | null; dateKey?: string | null;
};
export function catalogueAgeMonths(person: {
  recipientType?: string; statedAgeYears?: number | null; birthDateIso?: string | null;
} | null, dateKey: string | null, restored?: PartyRecipientContext | null): number | null {
  if (person) {
    if (person.recipientType === "adult") return null;
    if (person.recipientType === "guest" && person.statedAgeYears != null) {
      return person.statedAgeYears >= 0 && person.statedAgeYears < 18 ? person.statedAgeYears * 12 : null;
    }
    return ageMonthsOnDate(person.birthDateIso, calendarDateKeyToIso(dateKey));
  }
  const months = restored?.ageMonths;
  return dateKey && restored?.dateKey === dateKey && typeof months === "number" &&
    Number.isInteger(months) && months >= 0 && months <= 251 ? months : null;
}
