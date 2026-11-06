import { ageMonthsIntervalAt, type ChildBirthRecord } from "@/lib/child/birth";
import { PartyApiError } from "./partyDraft.validation";

/** A profile can represent someone who has since turned 18. Use age on the event date. */
export function assertPartyRecipientProfile(
  child: ChildBirthRecord,
  eventDate: Date | null,
  audience: string | null,
  statedYears: number | null,
) {
  if (!eventDate) return;
  const age = ageMonthsIntervalAt(child, eventDate);
  if (!age || age.min < 0) return;
  if ((audience === "ADULT" && age.max < 216) ||
      (audience === "CHILD" && age.min >= 216) ||
      (statedYears !== null && (age.max < statedYears * 12 || age.min > statedYears * 12 + 11))) {
    throw new PartyApiError(422, "Возраст не соответствует выбранному профилю на дату праздника");
  }
}
