import type { EventFormData } from "./types";

type BookingConfiguration = Pick<
  EventFormData,
  "participationMode" | "publicationAccess" | "ctaStepDraft" | "timeSlots"
>;

function validCapacity(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/**
 * Every configured date/slot must have a positive capacity before publishing.
 * Validate the source editor model: legacy timeSlots can omit incomplete rows,
 * and the compatibility mapper used to default an empty capacity to one seat.
 */
export function getEventBookingCapacityIssues(data: BookingConfiguration): string[] {
  if (data.participationMode !== "time-slots") return [];

  const issues: string[] = [];
  const cta = data.ctaStepDraft;
  if (cta?.actionChoice === "REQUEST" && cta.requestMode === "CALENDAR") {
    if (cta.calendarDays.length === 0) return ["Добавьте хотя бы одну дату для записи"];
    cta.calendarDays.forEach((day, dayIndex) => {
      const description = day.date || `блок ${dayIndex + 1}`;
      if (!day.date.trim()) issues.push(`Укажите дату (${description})`);
      if (cta.calendarMode !== "DATE_AND_TIME") {
        if (!validCapacity(day.capacity)) {
          issues.push(`Укажите вместимость (чел.) для даты ${description}`);
        }
        return;
      }
      if (day.slots.length === 0) {
        issues.push(`Добавьте слот для даты ${description}`);
      }
      day.slots.forEach((slot, slotIndex) => {
        const name = `${description}, слот ${slotIndex + 1}`;
        if (!slot.startTime.trim() || !slot.endTime.trim()) {
          issues.push(`Укажите время для ${name}`);
        }
        if (!validCapacity(slot.capacity)) {
          issues.push(`Укажите вместимость (чел.) для ${name}`);
        }
      });
    });
    return issues;
  }

  if (data.publicationAccess?.method === "timeslots") {
    const slots = data.publicationAccess.timeSlots ?? [];
    if (slots.length === 0) return ["Добавьте хотя бы одну дату со слотами"];
    slots.forEach((slot, index) => {
      const name = `${slot.date || "без даты"}, слот ${index + 1}`;
      if (!slot.date?.trim()) issues.push(`Укажите дату для ${name}`);
      if (!slot.startTime?.trim() || !slot.endTime?.trim()) {
        issues.push(`Укажите время для ${name}`);
      }
      if (!validCapacity(slot.capacity)) {
        issues.push(`Укажите вместимость (чел.) для ${name}`);
      }
    });
    return issues;
  }

  const dates = data.timeSlots?.dates ?? [];
  if (dates.length === 0 || dates.every((day) => day.slots.length === 0)) {
    return ["Добавьте хотя бы одну дату со слотами"];
  }
  dates.forEach((day) => {
    if (!day.isoDate.trim()) issues.push("Укажите дату для слотов");
    if (day.slots.length === 0) issues.push(`Добавьте слот для даты ${day.isoDate}`);
    day.slots.forEach((slot, index) => {
      const name = `${day.isoDate}, слот ${index + 1}`;
      if (!slot.startTime?.trim() || !slot.endTime?.trim()) {
        issues.push(`Укажите время для ${name}`);
      }
      if (!validCapacity(slot.capacity)) {
        issues.push(`Укажите вместимость (чел.) для ${name}`);
      }
    });
  });
  return issues;
}
