/**
 * Customer-supplied service notes may contain contact details. Do not expose
 * those before a parent accepts the quote. The parent-side copy stays intact.
 */
export function redactPartyContacts(value: string | null): string | null {
  if (!value) return value;
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[контакт скрыт]")
    .replace(/(?:https?:\/\/)?t\.me\/[a-zA-Z0-9_]{5,}/gi, "[контакт скрыт]")
    .replace(/@[a-zA-Z][a-zA-Z0-9_]{4,}/g, "[контакт скрыт]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, (candidate) =>
      candidate.replace(/\D/g, "").length >= 9 ? "[контакт скрыт]" : candidate);
}
