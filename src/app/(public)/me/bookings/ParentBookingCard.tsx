"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, MapPin, Baby, CheckCircle2, Clock, XCircle, Star } from "lucide-react";
import { BookingStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import type { ParentBookingItem } from "@/server/services/booking/parentBookings.service";
import { FeedbackWidget } from "./FeedbackWidget";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  NEW: {
    label: "Ожидает подтверждения",
    icon: Clock,
    className: "text-amber-600 bg-amber-50 border-amber-200",
  },
  CONFIRMED: {
    label: "Подтверждена",
    icon: CheckCircle2,
    className: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  COMPLETED: {
    label: "Завершена",
    icon: CheckCircle2,
    className: "text-neutral-500 bg-neutral-50 border-neutral-200",
  },
  REJECTED: {
    label: "Отклонена",
    icon: XCircle,
    className: "text-red-500 bg-red-50 border-red-200",
  },
  CANCELLED: {
    label: "Отменена",
    icon: XCircle,
    className: "text-neutral-400 bg-neutral-50 border-neutral-200",
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  booking: ParentBookingItem;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ParentBookingCard({ booking }: Props) {
  const [hasFeedback, setHasFeedback] = useState(booking.hasFeedback);
  const [feedbackRating, setFeedbackRating] = useState(booking.feedbackRating);

  const { display, status } = booking;
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  const isCancelled =
    status === BookingStatus.REJECTED || status === BookingStatus.CANCELLED;
  const isCompleted = status === BookingStatus.COMPLETED;
  const isConfirmed = status === BookingStatus.CONFIRMED;

  const publicationHref = booking.activity?.slug
    ? `/events/${booking.activity.slug}`
    : booking.offer?.slug
      ? `/offers/${booking.offer.slug}`
      : booking.place?.slug
        ? `/places/${booking.place.slug}`
        : null;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-white transition-shadow",
        isCancelled
          ? "border-neutral-100 opacity-70"
          : "border-neutral-200 shadow-sm hover:shadow-md",
      )}
    >
      {/* ── Cover + Status row ── */}
      <div className="flex items-start gap-4 p-4">
        {/* Cover image */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-neutral-100 sm:h-20 sm:w-20">
          {booking.coverImageUrl ? (
            <Image
              src={booking.coverImageUrl}
              alt={display.title}
              fill
              className="object-cover"
              sizes="80px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <MapPin className="h-6 w-6 text-neutral-300" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Status badge */}
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              config.className,
            )}
          >
            <StatusIcon className="h-3 w-3 shrink-0" />
            {config.label}
          </div>

          {/* Title */}
          <h3 className="text-[15px] font-semibold leading-snug text-neutral-900">
            {publicationHref ? (
              <Link
                href={publicationHref}
                className="hover:text-[#EF8759] transition-colors"
              >
                {display.title}
              </Link>
            ) : (
              display.title
            )}
          </h3>

          {/* Subtitle (dates, shift, slot) */}
          {display.subtitle && (
            <div className="flex items-center gap-1.5 text-[13px] text-[#EF8759]">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>{display.subtitle}</span>
            </div>
          )}

          {/* Business name */}
          {booking.businessName && (
            <div className="flex items-center gap-1.5 text-[12px] text-neutral-400">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{booking.businessName}</span>
            </div>
          )}

          {/* Child info */}
          {(booking.childName || booking.childAge != null) && (
            <div className="flex items-center gap-1.5 text-[12px] text-neutral-500">
              <Baby className="h-3 w-3 shrink-0" />
              <span>
                {[
                  booking.childName,
                  booking.childAge != null ? `${booking.childAge} лет` : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── CTA section ── */}
      {!isCancelled && (
        <div className="border-t border-neutral-100 px-4 py-3">
          {/* PENDING */}
          {status === BookingStatus.NEW && (
            <p className="text-[13px] text-neutral-400">
              Ожидаем подтверждения от организатора
            </p>
          )}

          {/* CONFIRMED */}
          {isConfirmed && (
            <div className="flex flex-wrap items-center gap-2">
              {publicationHref && (
                <Link
                  href={publicationHref}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 text-[13px] font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
                >
                  Открыть
                </Link>
              )}
              <AddToPlanButton booking={booking} />
            </div>
          )}

          {/* COMPLETED — feedback */}
          {isCompleted && !hasFeedback && (
            <FeedbackWidget
              bookingId={booking.id}
              onSubmitted={(rating) => {
                setHasFeedback(true);
                setFeedbackRating(rating);
              }}
            />
          )}

          {/* COMPLETED — already rated */}
          {isCompleted && hasFeedback && feedbackRating != null && (
            <div className="flex items-center gap-1.5 text-[13px] text-neutral-400">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span>Вы оценили на {feedbackRating} из 5</span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ─── Add to plan button ───────────────────────────────────────────────────────

function AddToPlanButton({ booking }: { booking: ParentBookingItem }) {
  // Only for activity-based bookings with a date
  if (!booking.activityId || !booking.requestedDate) return null;

  const dateStr = booking.requestedDate.split("T")[0];
  if (!dateStr) return null;

  const planHref = `/me/plan?add=${booking.activityId}&date=${dateStr}`;

  return (
    <Link
      href={planHref}
      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#ffb38a] bg-[linear-gradient(180deg,_#ffb185_0%,_#ff8f61_100%)] px-4 text-[13px] font-semibold text-white shadow-sm transition-all hover:-translate-y-px"
    >
      В план
    </Link>
  );
}
