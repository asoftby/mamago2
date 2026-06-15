"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, MapPin, Baby, CheckCircle2, Clock, XCircle, Star, Phone, MessageCircle, Route, ExternalLink } from "lucide-react";
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
    label: "Заявка отправлена",
    icon: Clock,
    className: "text-amber-600 bg-amber-50 border-amber-200",
  },
  CONFIRMED: {
    label: "Подтверждена",
    icon: CheckCircle2,
    className: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  COMPLETED: {
    label: "Посещение завершено",
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
  const isPending = status === BookingStatus.NEW;
  const publicationHref = booking.publicHref;
  const phoneHref = booking.organizerPhone
    ? `tel:${booking.organizerPhone.replace(/[^\d+]/g, "")}`
    : null;
  const messageHref = booking.organizerTelegramUrl ?? booking.organizerInstagramUrl;
  const routeHref = booking.mapUrl
    ? booking.mapUrl
    : booking.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address)}`
      : null;
  const hasContacts = Boolean(
    booking.organizerPhone ||
      booking.organizerTelegramUrl ||
      booking.organizerInstagramUrl ||
      booking.organizerWebsite ||
      booking.address,
  );

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
                className="hover:text-text-brand transition-colors"
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
      <div className="border-t border-neutral-100 px-4 py-3">
        {isPending && (
          <div className="space-y-3">
            <p className="text-[13px] text-neutral-500">
              Ожидаем подтверждения от организатора
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {publicationHref ? (
                <Link
                  href={publicationHref}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 text-[13px] font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
                >
                  Открыть
                </Link>
              ) : null}
            </div>
          </div>
        )}

        {isConfirmed && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                Контакты для связи
              </p>
              <div className="mt-1.5 space-y-1">
                <p className="text-sm font-medium text-neutral-900">
                  {booking.organizerName ?? booking.businessName ?? "Организатор"}
                </p>
                {booking.organizerPhone ? (
                  <p className="text-xs text-neutral-500">{booking.organizerPhone}</p>
                ) : null}
                {booking.address ? (
                  <p className="text-xs text-neutral-500">{booking.address}</p>
                ) : null}
                {booking.organizerWebsite ? (
                  <p className="text-xs text-neutral-500">{booking.organizerWebsite}</p>
                ) : null}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                Визит подтверждён организатором. Если планы изменились — свяжитесь с ним заранее.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {phoneHref ? (
                  <ActionLink href={phoneHref} icon={Phone} label="Позвонить" />
                ) : null}
                {messageHref ? (
                  <ActionLink href={messageHref} icon={MessageCircle} label="Написать" external />
                ) : null}
                {routeHref ? (
                  <ActionLink href={routeHref} icon={Route} label="Маршрут" external />
                ) : null}
                {publicationHref ? (
                  <ActionLink href={publicationHref} icon={ExternalLink} label="Открыть" />
                ) : null}
              </div>
              {!hasContacts && publicationHref ? (
                <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                  Контакты не указаны. Откройте запись, чтобы посмотреть детали.
                </p>
              ) : null}
            </div>
          </div>
        )}

        {isCompleted && !hasFeedback && (
          <div className="space-y-3">
            <p className="text-[13px] text-neutral-500">
              Посещение завершено
            </p>
            <FeedbackWidget
              bookingId={booking.id}
              onSubmitted={(rating) => {
                setHasFeedback(true);
                setFeedbackRating(rating);
              }}
            />
            {publicationHref ? (
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={publicationHref}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 text-[13px] font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
                >
                  Открыть
                </Link>
              </div>
            ) : null}
          </div>
        )}

        {isCompleted && hasFeedback && feedbackRating != null && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-[13px] text-neutral-400">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span>Вы оценили на {feedbackRating} из 5</span>
            </div>
            {publicationHref ? (
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={publicationHref}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 text-[13px] font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
                >
                  Открыть
                </Link>
              </div>
            ) : null}
          </div>
        )}

        {isCancelled && publicationHref ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={publicationHref}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 text-[13px] font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
            >
              Открыть
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ActionLink({
  href,
  icon: Icon,
  label,
  external = false,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  external?: boolean;
}) {
  const commonClassName =
    "inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 text-[13px] font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50";
  const content = (
    <>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </>
  );

  if (external || href.startsWith("tel:")) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={commonClassName}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={commonClassName}
    >
      {content}
    </Link>
  );
}
