import { z } from "zod";

/**
 * Состав группы в заявке на событие: сколько взрослых и какие дети придут.
 * Бизнесу отдаём только возраст и необязательное имя — никаких других полей профиля.
 */

export const BOOKING_MAX_ADULTS = 10;
export const BOOKING_MAX_CHILDREN = 10;
export const BOOKING_MAX_CHILD_AGE = 17;
export const BOOKING_CHILD_NAME_MAX = 50;

const childNameSchema = z
  .string()
  .trim()
  .max(BOOKING_CHILD_NAME_MAX, `Имя не длиннее ${BOOKING_CHILD_NAME_MAX} символов`)
  .transform((value) => (value.length > 0 ? value : undefined));

const childAgeSchema = z
  .number()
  .int("Возраст — целое число")
  .min(0, "Возраст не может быть отрицательным")
  .max(BOOKING_MAX_CHILD_AGE, `Возраст ребёнка — до ${BOOKING_MAX_CHILD_AGE} лет`);

/**
 * Ребёнок из запроса клиента. Либо `childId` (профиль — имя и возраст берём из БД,
 * присланные клиентом значения игнорируются), либо ручной ввод: возраст обязателен.
 */
export const bookingChildInputSchema = z
  .object({
    childId: z.string().trim().min(1).max(64).optional(),
    age: childAgeSchema.optional(),
    name: childNameSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.childId && value.age === undefined) {
      ctx.addIssue({ code: "custom", path: ["age"], message: "Укажите возраст ребёнка" });
    }
  });

export type BookingChildInput = z.infer<typeof bookingChildInputSchema>;

export const bookingChildrenInputSchema = z
  .array(bookingChildInputSchema)
  .max(BOOKING_MAX_CHILDREN, `Не больше ${BOOKING_MAX_CHILDREN} детей в одной заявке`);

/** То, что лежит в `BookingRequest.participantChildren` и уходит бизнесу. */
export const storedBookingChildSchema = z.object({
  name: z.string().max(BOOKING_CHILD_NAME_MAX).nullable(),
  age: z.number().int().min(0).max(BOOKING_MAX_CHILD_AGE).nullable(),
});
export type StoredBookingChild = z.infer<typeof storedBookingChildSchema>;
export const storedBookingChildrenSchema = z.array(storedBookingChildSchema).max(BOOKING_MAX_CHILDREN);

/** Безопасно читает JSON из БД: битые данные → пустой список, не падаем в кабинете. */
export function parseStoredChildren(value: unknown): StoredBookingChild[] {
  const parsed = storedBookingChildrenSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export class BookingParticipantsError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "BookingParticipantsError";
  }
}

/** Полных лет на `now`; нет даты рождения или вне 0..17 → null. */
export function ageFromBirthDate(birthDate: Date | null | undefined, now: Date = new Date()): number | null {
  if (!birthDate) return null;
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  if (!Number.isFinite(age) || age < 0 || age > BOOKING_MAX_CHILD_AGE) return null;
  return age;
}

export type ProfileChildRow = { id: string; name: string | null; birthDate: Date | null };

export type ResolvedParticipants = {
  adultsCount: number;
  childrenCount: number;
  children: StoredBookingChild[];
};

/**
 * Собирает итоговый состав. `profileChildren` — ТОЛЬКО строки, которые вызывающий уже
 * получил под ACL семьи (`childScopeFor`); любой `childId`, которого в них нет, — ошибка,
 * поэтому чужого ребёнка выбрать нельзя.
 */
export function resolveParticipants(params: {
  adultsCount: number;
  children: BookingChildInput[];
  profileChildren: ProfileChildRow[];
  now?: Date;
}): ResolvedParticipants {
  const { adultsCount, children, profileChildren, now = new Date() } = params;
  if (!Number.isInteger(adultsCount) || adultsCount < 1 || adultsCount > BOOKING_MAX_ADULTS) {
    throw new BookingParticipantsError("adultsCount", `Взрослых должно быть от 1 до ${BOOKING_MAX_ADULTS}`);
  }
  if (children.length > BOOKING_MAX_CHILDREN) {
    throw new BookingParticipantsError("children", `Не больше ${BOOKING_MAX_CHILDREN} детей в одной заявке`);
  }
  const byId = new Map(profileChildren.map((row) => [row.id, row]));
  const seen = new Set<string>();
  const resolved: StoredBookingChild[] = children.map((child) => {
    if (child.childId) {
      if (seen.has(child.childId)) {
        throw new BookingParticipantsError("children", "Один ребёнок выбран дважды");
      }
      seen.add(child.childId);
      const row = byId.get(child.childId);
      if (!row) throw new BookingParticipantsError("children", "Ребёнок не найден в вашем профиле");
      return {
        name: row.name?.trim().slice(0, BOOKING_CHILD_NAME_MAX) || null,
        age: ageFromBirthDate(row.birthDate, now),
      };
    }
    if (child.age === undefined) {
      throw new BookingParticipantsError("children", "Укажите возраст ребёнка");
    }
    return { name: child.name?.trim() || null, age: child.age };
  });
  return { adultsCount, childrenCount: resolved.length, children: resolved };
}

/** Только id профильных детей из запроса — для одного запроса в БД. */
export function requestedProfileChildIds(children: BookingChildInput[]): string[] {
  return [...new Set(children.flatMap((child) => (child.childId ? [child.childId] : [])))];
}

/* ─────────────── возрастные ограничения события ─────────────── */

export type EventAgeRule =
  | { kind: "ADULT_ONLY"; label: string }
  | { kind: "RANGE"; from: number; to: number; label: string };

type AgeRuleSource = {
  agePolicy?: string | null;
  ageTags?: string[] | null;
  ageMinMonths?: number | null;
  ageMaxMonths?: number | null;
};

function rangeLabel(from: number, to: number): string {
  return to >= 99 ? `${from}+` : `${from}–${to} лет`;
}

/** Правило возраста события или null, если ограничений нет / их не удалось определить. */
export function eventAgeRuleFromActivity(source: AgeRuleSource | null | undefined): EventAgeRule | null {
  if (!source) return null;
  if (source.agePolicy === "ADULT_ONLY") return { kind: "ADULT_ONLY", label: "взрослых (18+)" };
  if (source.agePolicy === "UNRESTRICTED") return null;

  let from: number | null = null;
  let to: number | null = null;
  if (source.ageMinMonths != null && Number.isFinite(source.ageMinMonths)) {
    from = Math.max(0, Math.floor(source.ageMinMonths / 12));
  }
  if (source.ageMaxMonths != null && Number.isFinite(source.ageMaxMonths)) {
    to = Math.min(99, Math.ceil(source.ageMaxMonths / 12));
  }
  if (from === null && to === null) {
    for (const rawTag of source.ageTags ?? []) {
      const tag = rawTag.trim();
      const range = tag.match(/^(\d+)\s*[-–]\s*(\d+)/);
      const plus = range ? null : tag.match(/^(\d+)\s*\+/);
      const lo = range ? Number.parseInt(range[1]!, 10) : plus ? Number.parseInt(plus[1]!, 10) : null;
      const hi = range ? Number.parseInt(range[2]!, 10) : plus ? 99 : null;
      if (lo === null || hi === null) continue;
      from = from === null ? lo : Math.min(from, lo);
      to = to === null ? hi : Math.max(to, hi);
    }
  }
  if (from === null && to === null) return null;
  const lo = from ?? 0;
  const hi = to ?? 99;
  if (lo <= 0 && hi >= 17) return null; // «любой возраст»
  return { kind: "RANGE", from: lo, to: hi, label: rangeLabel(lo, hi) };
}

/** Мягкое предупреждение для одного ребёнка или null, если всё в порядке. Запись не блокируется. */
export function childAgeWarning(age: number | null | undefined, rule: EventAgeRule | null): string | null {
  if (!rule) return null;
  if (rule.kind === "ADULT_ONLY") return `Событие для ${rule.label}`;
  if (age === null || age === undefined) return null;
  if (age < rule.from || age > rule.to) return `Событие для ${rule.label}`;
  return null;
}

/* ─────────────── подписи ─────────────── */

export function formatChildAge(age: number): string {
  if (age === 0) return "до года";
  const mod10 = age % 10;
  const mod100 = age % 100;
  if (mod10 === 1 && mod100 !== 11) return `${age} год`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${age} года`;
  return `${age} лет`;
}

/** «Маша (5)» / «5 лет» / «ребёнок». */
export function formatChildLabel(child: StoredBookingChild): string {
  if (child.name && child.age !== null) return `${child.name} (${child.age})`;
  if (child.name) return child.name;
  if (child.age !== null) return formatChildAge(child.age);
  return "ребёнок";
}

/** Строка состава для кабинета бизнеса: «Взрослые: 1 · Дети: Маша (5), 7 лет». */
export function formatParticipantsLine(params: {
  adultsCount: number;
  childrenCount: number;
  children: StoredBookingChild[];
  legacyChild?: { name: string | null; age: number | null };
}): string {
  const parts: string[] = [];
  if (params.adultsCount > 0) parts.push(`Взрослые: ${params.adultsCount}`);
  if (params.childrenCount > 0) {
    let kids = params.children;
    if (kids.length === 0 && params.legacyChild && (params.legacyChild.name || params.legacyChild.age !== null)) {
      kids = [{ name: params.legacyChild.name, age: params.legacyChild.age }];
    }
    parts.push(kids.length > 0 ? `Дети: ${kids.map(formatChildLabel).join(", ")}` : `Дети: ${params.childrenCount}`);
  }
  return parts.join(" · ");
}

/** Дети из заявки, возраст которых вне диапазона события (для пометки в кабинете). */
export function childrenOutsideEventAge(children: StoredBookingChild[], rule: EventAgeRule | null): StoredBookingChild[] {
  return children.filter((child) => childAgeWarning(child.age, rule) !== null);
}

/** Короткая строка для списка заявок без имён детей: «Взрослые: 2 · Дети: 2 (7, 4)». */
export function formatParticipantsSummary(params: {
  adultsCount: number;
  childrenCount: number;
  children: StoredBookingChild[];
}): string | null {
  const parts: string[] = [];
  if (params.adultsCount > 0) parts.push(`Взрослые: ${params.adultsCount}`);
  if (params.childrenCount > 0) {
    const ages = params.children.flatMap((child) => (child.age === null ? [] : [String(child.age)]));
    parts.push(ages.length > 0 ? `Дети: ${params.childrenCount} (${ages.join(", ")})` : `Дети: ${params.childrenCount}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
