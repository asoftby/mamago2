import type { BirthdayOffer } from "../../types/birthday";

export type TimeMode =
  | "VENUE_SLOT"      // площадка: интервал бронирования
  | "EXACT_TIME"      // аниматор / шоу: точное время выступления
  | "DELIVERY_BEFORE" // торт / еда: доставить до
  | "SETUP_RANGE"     // декор: монтаж, начало–конец
  | "NO_TIME";        // время не требуется

export type ScenarioItemSchedule = {
  timeMode: TimeMode;
  /** HH:mm – начало (null для DELIVERY_BEFORE / NO_TIME) */
  startAt: string | null;
  /** HH:mm – конец (null для DELIVERY_BEFORE / NO_TIME) */
  endAt: string | null;
  /** HH:mm – для DELIVERY_BEFORE: доставить до */
  deliveryBeforeAt: string | null;
  /** true — пользователь вручную изменил время, не перезаписывать при смене глобального пресета */
  isManuallySet: boolean;
};

export type ScheduleConflict = {
  itemId: string;
  message: string;
};

// ─── Time helpers ─────────────────────────────────────────────────────────────

export function timeToMins(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minsToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(mins, 23 * 60 + 59));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function minsToTimeWrapped(mins: number): string {
  const minutesPerDay = 24 * 60;
  const wrapped = ((mins % minutesPerDay) + minutesPerDay) % minutesPerDay;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 30-min slots 08:00–22:00 */
export const TIME_OPTIONS: string[] = Array.from({ length: 29 }, (_, i) =>
  minsToTime(8 * 60 + i * 30),
);

export function calculateBookingInterval(
  startTime: string,
  durationHours: number,
): {
  startsAt: string;
  endsAt: string;
  label: string;
} {
  const safeDurationHours =
    Number.isFinite(durationHours) && durationHours > 0 ? durationHours : 3;
  const startsAt = startTime;
  const endsAt = minsToTimeWrapped(
    timeToMins(startTime) + safeDurationHours * 60,
  );

  return {
    startsAt,
    endsAt,
    label: `${startsAt} — ${endsAt}`,
  };
}

export function getVenueBookingDurationOptions(
  offer?: BirthdayOffer | null,
): number[] {
  const explicitOptions = (offer?.availableBookingDurationsHours ?? [])
    .map((value) => Math.round(Number(value)))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (explicitOptions.length > 0) {
    return Array.from(new Set(explicitOptions)).sort((a, b) => a - b);
  }

  const min = offer?.minBookingHours ? Math.round(offer.minBookingHours) : null;
  const max = offer?.maxBookingHours ? Math.round(offer.maxBookingHours) : null;
  if (min && max && min > 0 && max >= min) {
    return Array.from({ length: max - min + 1 }, (_, index) => min + index);
  }

  // TODO: replace fallback when venue booking intervals come from admin/business.
  return [1, 2, 3];
}

// ─── Mode & defaults ──────────────────────────────────────────────────────────

export function timeModeForTag(tag: string): TimeMode {
  switch (tag) {
    case "площадка": return "VENUE_SLOT";
    case "аниматор": return "EXACT_TIME";
    case "торт":
    case "еда":      return "DELIVERY_BEFORE";
    case "декор":    return "SETUP_RANGE";
    default:         return "NO_TIME";
  }
}

export function defaultSchedule(
  tag: string,
  partyStart: string,
  options?: { venueDurationHours?: number },
): ScenarioItemSchedule {
  const mode = timeModeForTag(tag);
  const s = timeToMins(partyStart);

  switch (mode) {
    case "VENUE_SLOT": {
      const interval = calculateBookingInterval(
        partyStart,
        options?.venueDurationHours ?? 3,
      );
      return {
        timeMode: mode,
        startAt: interval.startsAt,
        endAt: interval.endsAt,
        deliveryBeforeAt: null,
        isManuallySet: false,
      };
    }
    case "EXACT_TIME":
      return { timeMode: mode, startAt: minsToTime(s + 60), endAt: minsToTime(s + 120), deliveryBeforeAt: null, isManuallySet: false };
    case "DELIVERY_BEFORE":
      return { timeMode: mode, startAt: null, endAt: null, deliveryBeforeAt: partyStart, isManuallySet: false };
    case "SETUP_RANGE":
      return { timeMode: mode, startAt: minsToTime(s - 120), endAt: minsToTime(s - 30), deliveryBeforeAt: null, isManuallySet: false };
    case "NO_TIME":
      return { timeMode: mode, startAt: null, endAt: null, deliveryBeforeAt: null, isManuallySet: false };
  }
}

// ─── Conflict detection ───────────────────────────────────────────────────────

export function detectConflicts(
  items: Array<{ id: string; tag: string }>,
  schedules: Record<string, ScenarioItemSchedule>,
): ScheduleConflict[] {
  const warnings: ScheduleConflict[] = [];

  const venueItem = items.find((i) => i.tag === "площадка");
  const venueSch = venueItem ? schedules[venueItem.id] : null;
  const venueStart = venueSch?.startAt ? timeToMins(venueSch.startAt) : null;
  const venueEnd   = venueSch?.endAt   ? timeToMins(venueSch.endAt)   : null;

  for (const item of items) {
    const sch = schedules[item.id];
    if (!sch) continue;

    if (item.tag === "аниматор" && sch.startAt && sch.endAt && venueStart !== null && venueEnd !== null) {
      const aStart = timeToMins(sch.startAt);
      const aEnd   = timeToMins(sch.endAt);
      if (aStart < venueStart || aEnd > venueEnd) {
        warnings.push({ itemId: item.id, message: "Время выходит за границы площадки" });
      }
    }

    if ((item.tag === "торт" || item.tag === "еда") && sch.deliveryBeforeAt) {
      const delivMins = timeToMins(sch.deliveryBeforeAt);
      const partyMins = venueStart ?? (items.find((i) => i.tag !== item.tag && schedules[i.id]?.startAt)
        ? timeToMins(schedules[items.find((i) => schedules[i.id]?.startAt)!.id]!.startAt!)
        : null);
      if (partyMins !== null && delivMins > partyMins) {
        warnings.push({ itemId: item.id, message: "Доставка позже начала праздника" });
      }
    }

    if (item.tag === "декор" && sch.endAt && venueStart !== null) {
      if (timeToMins(sch.endAt) > venueStart) {
        warnings.push({ itemId: item.id, message: "Монтаж не завершён до начала праздника" });
      }
    }
  }

  return warnings;
}

// ─── Label helpers ────────────────────────────────────────────────────────────

export function scheduleChipLabel(sch: ScenarioItemSchedule): string | null {
  switch (sch.timeMode) {
    case "VENUE_SLOT":
    case "EXACT_TIME":
    case "SETUP_RANGE":
      if (sch.startAt && sch.endAt) return `${sch.startAt} – ${sch.endAt}`;
      return null;
    case "DELIVERY_BEFORE":
      if (sch.deliveryBeforeAt) return `до ${sch.deliveryBeforeAt}`;
      return null;
    case "NO_TIME":
      return null;
  }
}
