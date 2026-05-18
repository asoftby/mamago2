/**
 * Unified Booking Analytics Helper
 *
 * Provides typed API for tracking booking lifecycle events:
 * - BOOKING_CREATED: When user creates a booking
 * - BOOKING_CONFIRMED: When business confirms a booking
 * - BOOKING_COMPLETED: When booking is marked as completed
 * - BOOKING_CANCELLED: When booking is cancelled
 * - FEEDBACK_LEFT: When user submits feedback
 *
 * Uses existing analytics pipeline (trackUserEvent).
 * Fire-and-forget pattern — errors are logged but don't break main flow.
 */

import type { AnalyticsEntityType, AnalyticsVertical, UserEventType } from "@prisma/client";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BookingEventType =
  | "BOOKING_CREATED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_COMPLETED"
  | "BOOKING_CANCELLED"
  | "FEEDBACK_LEFT";

export interface TrackBookingEventInput {
  /** Event type */
  type: BookingEventType;

  /** User ID (if authenticated) */
  userId?: string | null;

  /** Booking ID */
  bookingId: string;

  /** Entity type (OFFER, EVENT, PLACE, etc.) */
  entityType: AnalyticsEntityType;

  /** Entity ID (offerId, activityId, placeId, etc.) */
  entityId: string;

  /** Vertical (CITY, TRAVEL, BIRTHDAY, etc.) */
  vertical?: AnalyticsVertical | null;

  /** City ID */
  cityId?: string | null;

  /** Additional metadata */
  metadata?: {
    /** Booking status (NEW, CONFIRMED, COMPLETED, CANCELLED) */
    status?: string;

    /** Shift ID (for camp bookings) */
    shiftId?: string | null;

    /** Shift title (for camp bookings) */
    shiftTitle?: string | null;

    /** Booking source (detail, listing, recommendation) */
    source?: string;

    /** UI surface (web, mobile, admin) */
    surface?: string;

    /** Rating (for FEEDBACK_LEFT) */
    rating?: number;

    /** Has feedback text (for FEEDBACK_LEFT) */
    hasText?: boolean;

    /** Response time in minutes (for BOOKING_CONFIRMED) */
    responseTimeMinutes?: number;

    /** Custom fields */
    [key: string]: unknown;
  };
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Track a booking lifecycle event.
 *
 * @param input - Event details
 * @returns Promise that resolves when event is recorded (fire-and-forget)
 *
 * @example
 * await trackBookingEvent({
 *   type: "BOOKING_CREATED",
 *   userId: user.id,
 *   bookingId: booking.id,
 *   entityType: "OFFER",
 *   entityId: offer.id,
 *   vertical: "CITY",
 *   cityId: city.id,
 *   metadata: {
 *     status: "NEW",
 *     source: "detail",
 *     surface: "web",
 *   },
 * });
 */
export async function trackBookingEvent(input: TrackBookingEventInput): Promise<void> {
  try {
    // Map booking event type to UserEventType
    const eventType = input.type as UserEventType;

    // Build metadata
    const meta: Record<string, unknown> = {
      bookingId: input.bookingId,
      targetAction: "book",
      ...input.metadata,
    };

    // Track event using existing pipeline
    await trackUserEvent({
      userId: input.userId ?? null,
      sessionId: null, // Server-side event, no session context
      eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      vertical: input.vertical ?? null,
      cityId: input.cityId ?? null,
      meta,
    });
  } catch (error) {
    // Log error but don't throw — analytics should never break main flow
    console.error("[trackBookingEvent] failed:", {
      type: input.type,
      bookingId: input.bookingId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─── Convenience functions ────────────────────────────────────────────────────

/**
 * Track BOOKING_CREATED event.
 */
export async function trackBookingCreated(
  input: Omit<TrackBookingEventInput, "type">,
): Promise<void> {
  return trackBookingEvent({ ...input, type: "BOOKING_CREATED" });
}

/**
 * Track BOOKING_CONFIRMED event.
 */
export async function trackBookingConfirmed(
  input: Omit<TrackBookingEventInput, "type">,
): Promise<void> {
  return trackBookingEvent({ ...input, type: "BOOKING_CONFIRMED" });
}

/**
 * Track BOOKING_COMPLETED event.
 */
export async function trackBookingCompleted(
  input: Omit<TrackBookingEventInput, "type">,
): Promise<void> {
  return trackBookingEvent({ ...input, type: "BOOKING_COMPLETED" });
}

/**
 * Track BOOKING_CANCELLED event.
 */
export async function trackBookingCancelled(
  input: Omit<TrackBookingEventInput, "type">,
): Promise<void> {
  return trackBookingEvent({ ...input, type: "BOOKING_CANCELLED" });
}

/**
 * Track FEEDBACK_LEFT event.
 */
export async function trackFeedbackLeft(
  input: Omit<TrackBookingEventInput, "type">,
): Promise<void> {
  return trackBookingEvent({ ...input, type: "FEEDBACK_LEFT" });
}
