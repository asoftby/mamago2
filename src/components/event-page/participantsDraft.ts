import {
  BOOKING_MAX_ADULTS,
  BOOKING_MAX_CHILDREN,
  BOOKING_MAX_CHILD_AGE,
  BOOKING_CHILD_NAME_MAX,
  type BookingChildInput,
} from "@/lib/booking/bookingParticipants";

/** Состояние блока «Кого записываем» в окне записи. */
export type ParticipantsDraft = {
  adults: number;
  profileChildIds: string[];
  manual: Array<{ key: string; age: string; name: string }>;
};

export const INITIAL_PARTICIPANTS_DRAFT: ParticipantsDraft = { adults: 1, profileChildIds: [], manual: [] };

export function clampAdults(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(BOOKING_MAX_ADULTS, Math.max(1, Math.trunc(value)));
}

export function totalChildren(draft: ParticipantsDraft): number {
  return draft.profileChildIds.length + draft.manual.length;
}

export function canAddChild(draft: ParticipantsDraft): boolean {
  return totalChildren(draft) < BOOKING_MAX_CHILDREN;
}

/** Целый возраст 0..17 из строки поля или null. */
export function parseManualAge(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d{1,2}$/.test(text)) return null;
  const age = Number.parseInt(text, 10);
  return age >= 0 && age <= BOOKING_MAX_CHILD_AGE ? age : null;
}

/** Ошибки по ключам ручных детей: возраст обязателен. */
export function validateParticipantsDraft(draft: ParticipantsDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const child of draft.manual) {
    if (parseManualAge(child.age) === null) errors[child.key] = `Возраст — число от 0 до ${BOOKING_MAX_CHILD_AGE}`;
    else if (child.name.trim().length > BOOKING_CHILD_NAME_MAX) errors[child.key] = `Имя не длиннее ${BOOKING_CHILD_NAME_MAX} символов`;
  }
  return errors;
}

/** Payload для POST /api/public/bookings. Для профильных детей уходит только id. */
export function participantsDraftToPayload(draft: ParticipantsDraft): { adultsCount: number; childrenCount: number; children: BookingChildInput[] } {
  const children: BookingChildInput[] = [
    ...draft.profileChildIds.map((childId) => ({ childId })),
    ...draft.manual.flatMap((child) => {
      const age = parseManualAge(child.age);
      const name = child.name.trim();
      return age === null ? [] : [{ age, ...(name ? { name } : {}) }];
    }),
  ];
  return { adultsCount: clampAdults(draft.adults), childrenCount: children.length, children };
}
