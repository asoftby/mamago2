/**
 * Форма заявки на праздник из подборки. Чистая логика: валидация зеркалит правила Party-потока
 * (`partyDraft.validation`, `partySubmit.service`), но авторитетна всё равно серверная проверка.
 */
export type CollectionLeadForm = {
  eventDate: string; // YYYY-MM-DD или ""
  timeFrom: string; // HH:MM
  timeTo: string;
  children: number;
  adults: number;
  childAge: number | null;
  contactName: string;
  contactPhone: string;
  comment: string;
};

export type CollectionLeadLimits = { minChildren: number | null; maxChildren: number | null };
export type CollectionLeadErrors = Partial<Record<keyof CollectionLeadForm, string>>;

export const DEFAULT_LEAD_FORM: CollectionLeadForm = {
  eventDate: "",
  timeFrom: "12:00",
  timeTo: "14:00",
  children: 8,
  adults: 2,
  childAge: null,
  contactName: "",
  contactPhone: "+375",
  comment: "",
};

export function clampChildren(value: number, limits: CollectionLeadLimits): number {
  const min = Math.max(1, limits.minChildren ?? 1);
  const max = limits.maxChildren ?? 500;
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function initialLeadForm(limits: CollectionLeadLimits, overrides: Partial<CollectionLeadForm> = {}): CollectionLeadForm {
  return {
    ...DEFAULT_LEAD_FORM,
    ...overrides,
    children: clampChildren(overrides.children ?? DEFAULT_LEAD_FORM.children, limits),
  };
}

/** Старт праздника по Минску (UTC+3) — как на сервере. */
export function leadStartsAt(form: Pick<CollectionLeadForm, "eventDate" | "timeFrom">): Date {
  return new Date(`${form.eventDate}T${form.timeFrom}:00+03:00`);
}

/**
 * Самая ранняя календарная дата (YYYY-MM-DD, Минск): день, на который приходится граница «через 24 часа».
 * Это только ограничение календаря; точное правило (старт строго позже 24 часов) проверяет `validateLeadForm`.
 */
export function earliestLeadDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Minsk", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(now.getTime() + 24 * 3600_000));
}

export function validateLeadForm(form: CollectionLeadForm, limits: CollectionLeadLimits, now: Date = new Date()): CollectionLeadErrors {
  const errors: CollectionLeadErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.eventDate)) {
    errors.eventDate = "Выберите дату праздника";
  } else if (leadStartsAt(form).getTime() <= now.getTime() + 24 * 3600_000) {
    errors.eventDate = "До праздника должно оставаться больше 24 часов";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.timeFrom) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.timeTo)) {
    errors.timeFrom = "Укажите время";
  } else if (form.timeTo <= form.timeFrom) {
    errors.timeTo = "Окончание должно быть позже начала";
  }
  if (form.children < 1) errors.children = "Минимум 1 ребёнок";
  else if (limits.minChildren != null && form.children < limits.minChildren) errors.children = `Минимум ${limits.minChildren} детей`;
  else if (limits.maxChildren != null && form.children > limits.maxChildren) errors.children = `Не больше ${limits.maxChildren} детей`;
  if (form.adults < 0 || form.adults > 500) errors.adults = "Проверьте число взрослых";
  if (!form.contactName.trim()) errors.contactName = "Как к вам обращаться?";
  const digits = form.contactPhone.replace(/\D/g, "");
  if (!/^\+?[0-9()\-\s]{7,24}$/.test(form.contactPhone.trim()) || digits.length < 9) errors.contactPhone = "Укажите телефон для связи";
  if (form.comment.length > 500) errors.comment = "Не больше 500 символов";
  return errors;
}

export const LEAD_DRAFT_TTL_MS = 2 * 60 * 60_000;
const DRAFT_PREFIX = "mamago:collection-lead:";

type StoredLeadDraft = { savedAt: number; form: CollectionLeadForm };

export function serializeLeadDraft(form: CollectionLeadForm, now: number = Date.now()): string {
  return JSON.stringify({ savedAt: now, form } satisfies StoredLeadDraft);
}

/** Возвращает форму только если запись свежая и валидна по структуре; иначе `null`. */
export function parseLeadDraft(raw: string | null, now: number = Date.now()): CollectionLeadForm | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredLeadDraft>;
    if (!parsed || typeof parsed.savedAt !== "number" || now - parsed.savedAt > LEAD_DRAFT_TTL_MS || now < parsed.savedAt - 60_000) return null;
    const f = parsed.form as Partial<CollectionLeadForm> | undefined;
    if (!f || typeof f.eventDate !== "string" || typeof f.contactPhone !== "string") return null;
    return {
      ...DEFAULT_LEAD_FORM,
      eventDate: f.eventDate,
      timeFrom: typeof f.timeFrom === "string" ? f.timeFrom : DEFAULT_LEAD_FORM.timeFrom,
      timeTo: typeof f.timeTo === "string" ? f.timeTo : DEFAULT_LEAD_FORM.timeTo,
      children: typeof f.children === "number" ? f.children : DEFAULT_LEAD_FORM.children,
      adults: typeof f.adults === "number" ? f.adults : DEFAULT_LEAD_FORM.adults,
      childAge: typeof f.childAge === "number" ? f.childAge : null,
      contactName: typeof f.contactName === "string" ? f.contactName : "",
      contactPhone: f.contactPhone,
      comment: typeof f.comment === "string" ? f.comment : "",
    };
  } catch {
    return null;
  }
}

export function leadDraftKey(offerId: string): string {
  return DRAFT_PREFIX + offerId;
}

export function saveLeadDraft(offerId: string, form: CollectionLeadForm): void {
  try {
    localStorage.setItem(leadDraftKey(offerId), serializeLeadDraft(form));
  } catch {
    /* хранилище недоступно: после входа форму придётся заполнить заново */
  }
}

export function loadLeadDraft(offerId: string): CollectionLeadForm | null {
  try {
    return parseLeadDraft(localStorage.getItem(leadDraftKey(offerId)));
  } catch {
    return null;
  }
}

export function clearLeadDraft(offerId: string): void {
  try {
    localStorage.removeItem(leadDraftKey(offerId));
  } catch {
    /* noop */
  }
}

/** Маркер возврата после входа: `?leadOffer=<offerId>` в redirectTo. */
export const LEAD_RETURN_PARAM = "leadOffer";

export function withLeadReturnParam(pathWithSearch: string, offerId: string): string {
  const [path, hash = ""] = pathWithSearch.split("#");
  const url = new URL(path, "https://x.invalid");
  url.searchParams.set(LEAD_RETURN_PARAM, offerId);
  return `${url.pathname}${url.search}${hash ? `#${hash}` : ""}`;
}
