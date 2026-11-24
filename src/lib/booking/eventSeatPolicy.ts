/** Shared seat accounting for the wizard, public forms, and transactional booking. */
export const EVENT_SEAT_MODES = ["ALL", "CHILDREN", "ADULTS", "SEPARATE"] as const;
export type EventSeatMode = (typeof EVENT_SEAT_MODES)[number];

export type EventSeatPolicy = {
  mode: EventSeatMode;
  adultsCapacity: number | null;
  childrenCapacity: number | null;
};
export type EventSeatAvailability = {
  capacity: number;
  remaining: number;
  mode?: EventSeatMode;
  adultsCapacity?: number;
  childrenCapacity?: number;
  adultsRemaining?: number;
  childrenRemaining?: number;
};

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Old events deliberately default to ALL, preserving existing booking logic. */
export function getEventSeatPolicy(scheduleJson: unknown): EventSeatPolicy {
  const data = scheduleJson && typeof scheduleJson === "object" && !Array.isArray(scheduleJson)
    ? scheduleJson as Record<string, unknown>
    : {};
  const raw = data.eventSeatMode;
  const mode: EventSeatMode = EVENT_SEAT_MODES.some((candidate) => candidate === raw)
    ? raw as EventSeatMode
    : "ALL";
  return {
    mode,
    adultsCapacity: nonNegativeInteger(data.adultSeatCapacity),
    childrenCapacity: nonNegativeInteger(data.childSeatCapacity),
  };
}

export function occupiedEventSeats(mode: EventSeatMode, adults: number, children: number): number {
  if (mode === "CHILDREN") return children;
  if (mode === "ADULTS") return adults;
  return adults + children;
}

/** null means unlimited capacity, except SEPARATE (quotas are required). */
export function calculateEventSeatAvailability(input: {
  policy: EventSeatPolicy;
  capacity: number | null | undefined;
  usedAdults: number;
  usedChildren: number;
}): EventSeatAvailability | null {
  const { policy, usedAdults, usedChildren } = input;
  if (policy.mode === "SEPARATE") {
    const adultsCapacity = policy.adultsCapacity ?? 0;
    const childrenCapacity = policy.childrenCapacity ?? 0;
    const adultsRemaining = Math.max(0, adultsCapacity - usedAdults);
    const childrenRemaining = Math.max(0, childrenCapacity - usedChildren);
    return {
      mode: "SEPARATE", capacity: adultsCapacity + childrenCapacity,
      remaining: adultsRemaining + childrenRemaining,
      adultsCapacity, childrenCapacity, adultsRemaining, childrenRemaining,
    };
  }
  const capacity = nonNegativeInteger(input.capacity);
  if (capacity === null) return null;
  const taken = occupiedEventSeats(policy.mode, usedAdults, usedChildren);
  const remaining = Math.max(0, capacity - taken);
  return policy.mode === "ALL" ? { capacity, remaining } : { mode: policy.mode, capacity, remaining };
}

/** Used for advisory inline UX and definitive transactional server validation. */
export function getEventSeatError(
  availability: EventSeatAvailability | null | undefined,
  adults: number,
  children: number,
  mode: EventSeatMode,
): string | null {
  if (!Number.isSafeInteger(adults) || !Number.isSafeInteger(children) ||
      adults < 0 || children < 0 || adults + children < 1) {
    return "Укажите хотя бы одного участника";
  }
  if (mode === "CHILDREN" && children === 0) return "Добавьте хотя бы одного ребёнка";
  if (mode === "ADULTS" && adults === 0) return "Добавьте хотя бы одного взрослого";
  if (!availability) return null;
  if (mode === "SEPARATE") {
    if (availability.adultsCapacity === undefined || availability.childrenCapacity === undefined) {
      return "Организатор ещё не настроил места для взрослых и детей";
    }
    if (adults > (availability.adultsRemaining ?? 0)) {
      return "Недостаточно взрослых мест: свободно " + (availability.adultsRemaining ?? 0);
    }
    if (children > (availability.childrenRemaining ?? 0)) {
      return "Недостаточно детских мест: свободно " + (availability.childrenRemaining ?? 0);
    }
    return null;
  }
  const requested = occupiedEventSeats(mode, adults, children);
  if (requested > availability.remaining) {
    return "На выбранное время недостаточно мест. Нужно: " + requested + ", свободно: " + availability.remaining + ". Уменьшите количество участников";
  }
  return null;
}
