/**
 * Единая серверная классификация заявок по следующему действию.
 * Дедлайны вычисляются при чтении: не зависим от запуска cron.
 */
import type { BookingKind, BookingStatus, PartyRequestStage, QuoteStatus } from "@prisma/client";

export type BookingBucket = "ACTION_REQUIRED" | "UPCOMING" | "AWAITING_CUSTOMER" | "ARCHIVE";
export type BookingUrgency = "CUSTOMER_WAITING" | "HOUSEKEEPING" | null;
export type BookingNextAction =
  | "RESPOND" | "RECONFIRM" | "EXTEND_OR_CLOSE" | "CLOSE_VISIT"
  | "VIEW_UPCOMING" | "WAIT_CUSTOMER" | "VIEW_ARCHIVE";

export interface BookingBucketInput {
  kind: BookingKind;
  status: BookingStatus;
  partyStage?: PartyRequestStage | null;
  createdAt: Date;
  firstResponseAt?: Date | null;
  serviceEndsAt?: Date | null;
  hasServiceDate?: boolean;
  responseDueAt?: Date | null;
  quoteStatus?: QuoteStatus | null;
  quoteValidUntil?: Date | null;
}
export interface BookingBucketDecision {
  bucket: BookingBucket;
  urgency: BookingUrgency;
  action: BookingNextAction;
  deadline: Date | null;
}

const HOUSEKEEPING_AFTER_MS = 30 * 86_400_000;
const archive = (): BookingBucketDecision =>
  ({ bucket: "ARCHIVE", urgency: null, action: "VIEW_ARCHIVE", deadline: null });
const action = (what: BookingNextAction, deadline: Date | null, urgency: BookingUrgency = "CUSTOMER_WAITING"): BookingBucketDecision =>
  ({ bucket: "ACTION_REQUIRED", urgency, action: what, deadline });

/** Неконсистентные пары не допускается молча классифицировать и считать. */
export function assertPartyStatusPair(stage: PartyRequestStage | null | undefined, status: BookingStatus): void {
  const allowed: Partial<Record<PartyRequestStage, BookingStatus[]>> = {
    SENT: ["NEW"],
    QUOTED: ["NEW"],
    AWAITING_RECONFIRM: ["NEW"],
    CONFIRMED: ["CONFIRMED"],
    DECLINED: ["REJECTED"],
    EXPIRED: ["EXPIRED"],
    NOT_ACCEPTED: ["CANCELLED"],
    CANCELLED: ["CANCELLED"],
  };
  if (!stage || !(allowed[stage] ?? []).includes(status)) {
    throw new Error("Inconsistent PARTY stage and BookingStatus");
  }
}

export function bookingBucket(input: BookingBucketInput, now = new Date()): BookingBucketDecision {
  const time = now.getTime();
  if (input.kind === "PARTY") {
    assertPartyStatusPair(input.partyStage, input.status);
    const stage = input.partyStage!;
    if (stage === "SENT" || stage === "AWAITING_RECONFIRM") {
      if (input.responseDueAt && input.responseDueAt.getTime() <= time) return archive();
      return action(stage === "SENT" ? "RESPOND" : "RECONFIRM", input.responseDueAt ?? input.serviceEndsAt ?? null);
    }
    if (stage === "QUOTED") {
      if (input.serviceEndsAt && input.serviceEndsAt.getTime() <= time) return archive();
      // Истёкшее предложение возвращается бизнесу, но не закрывает весь запрос.
      if (input.quoteStatus !== "ACTIVE" ||
          !input.quoteValidUntil || input.quoteValidUntil.getTime() <= time) {
        return action("EXTEND_OR_CLOSE", input.quoteValidUntil ?? null);
      }
      return { bucket: "AWAITING_CUSTOMER", urgency: null, action: "WAIT_CUSTOMER", deadline: input.quoteValidUntil };
    }
    if (stage !== "CONFIRMED") return archive();
    // PARTY completion has its own lifecycle. The STANDARD-only CLOSE_VISIT
    // endpoint must not be offered for a confirmed party. Once elapsed,
    // show it read-only in Archive without changing its CONFIRMED DB status.
    if (input.serviceEndsAt && input.serviceEndsAt.getTime() <= time) return archive();
    // An undated PARTY must not enter STANDARD housekeeping after 30 days.
    return { bucket: "UPCOMING", urgency: null, action: "VIEW_UPCOMING", deadline: null };
  } else {
    if (input.status === "NEW") return action("RESPOND", input.serviceEndsAt ?? null);
    if (input.status !== "CONFIRMED") return archive();
  }
  const dateKnown = input.hasServiceDate ?? Boolean(input.serviceEndsAt);
  if (dateKnown && input.serviceEndsAt && input.serviceEndsAt.getTime() <= time) {
    return action("CLOSE_VISIT", null, "HOUSEKEEPING");
  }
  if (!dateKnown &&
      time - (input.firstResponseAt ?? input.createdAt).getTime() >= HOUSEKEEPING_AFTER_MS) {
    return action("CLOSE_VISIT", null, "HOUSEKEEPING");
  }
  return { bucket: "UPCOMING", urgency: null, action: "VIEW_UPCOMING", deadline: null };
}

export function compareBookingDecisions(
  a: { decision: BookingBucketDecision; createdAt: Date; serviceEndsAt?: Date | null },
  b: { decision: BookingBucketDecision; createdAt: Date; serviceEndsAt?: Date | null },
): number {
  if (a.decision.bucket === "ACTION_REQUIRED" && b.decision.bucket === "ACTION_REQUIRED") {
    if (a.decision.urgency !== b.decision.urgency) {
      return a.decision.urgency === "CUSTOMER_WAITING" ? -1 : 1;
    }
    if (a.decision.urgency === "CUSTOMER_WAITING") {
      return (a.decision.deadline?.getTime() ?? Infinity) -
        (b.decision.deadline?.getTime() ?? Infinity) || a.createdAt.getTime() - b.createdAt.getTime();
    }
  }
  if (a.decision.bucket === "UPCOMING" && b.decision.bucket === "UPCOMING") {
    return (a.serviceEndsAt?.getTime() ?? Infinity) -
      (b.serviceEndsAt?.getTime() ?? Infinity);
  }
  if (a.decision.bucket === "AWAITING_CUSTOMER" && b.decision.bucket === "AWAITING_CUSTOMER") {
    return (a.decision.deadline?.getTime() ?? Infinity) -
      (b.decision.deadline?.getTime() ?? Infinity);
  }
  return b.createdAt.getTime() - a.createdAt.getTime();
}
