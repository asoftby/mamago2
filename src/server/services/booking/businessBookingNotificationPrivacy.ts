/**
 * BUSINESS notifications are sent outside the authenticated order-detail
 * screen (Telegram, email, in-app push). They must never carry customer or
 * child identity in either rendered body or stored templatePayload metadata.
 * Staff may inspect the specific order via its audited, ACL-gated detail API.
 */
import {
  buildBookingActorLabel, buildBookingNotificationBody,
  type BookingNotificationBodyInput,
} from "./booking.formatters";
import { resolveBookingSourceType } from "./booking.types";

export type BusinessBookingNotificationContext = {
  offerId?: string | null;
  activityId?: string | null;
  placeId?: string | null;
  campShiftId?: string | null;
  offerTitle?: string | null;
  activityTitle?: string | null;
  placeTitle?: string | null;
  campShiftTitle?: string | null;
  campShiftDateFrom?: string | null;
  campShiftDateTo?: string | null;
  // These must not leave the authenticated booking service:
  customerName?: string | null;
  childName?: string | null;
  childAge?: number | null;
};

export function buildPrivateBusinessBookingNotification(context: BusinessBookingNotificationContext): {
  body: string;
  templatePayload: Record<string, string>;
} {
  const sourceType = resolveBookingSourceType({
    campShiftId: context.campShiftId ?? null,
    offerId: context.offerId ?? null,
    activityId: context.activityId ?? null,
    placeId: context.placeId ?? null,
  });
  const publicBody: BookingNotificationBodyInput = {
    sourceType,
    offerTitle: context.offerTitle ?? null,
    activityTitle: context.activityTitle ?? null,
    placeTitle: context.placeTitle ?? null,
    campShiftTitle: context.campShiftTitle ?? null,
    campShiftDateFrom: context.campShiftDateFrom ?? null,
    campShiftDateTo: context.campShiftDateTo ?? null,
    customerName: "Клиент",
    childName: null,
    childAge: null,
  };
  const body = buildBookingNotificationBody(publicBody);
  const templatePayload: Record<string, string> = {
    bookingSummary: body,
    actor: buildBookingActorLabel(publicBody),
    customerName: "Клиент",
    ...(context.offerTitle ? { offerTitle: context.offerTitle } : {}),
    ...(context.activityTitle ? { activityTitle: context.activityTitle } : {}),
    ...(context.placeTitle ? { placeTitle: context.placeTitle } : {}),
    ...(context.campShiftTitle ? { campShiftTitle: context.campShiftTitle } : {}),
    ...(context.campShiftDateFrom ? { campShiftDateFrom: context.campShiftDateFrom } : {}),
    ...(context.campShiftDateTo ? { campShiftDateTo: context.campShiftDateTo } : {}),
  };
  return { body, templatePayload };
}
