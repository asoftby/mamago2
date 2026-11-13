"use client";

import { useState } from "react";
import Link from "next/link";
import { BookingStatus } from "@prisma/client";
import { MessageCircle, Phone, Route, Star } from "lucide-react";
import type { ParentBookingItem } from "@/server/services/booking/parentBookings.service";
import { Reveal } from "./Reveal";
import { IcArrow, IcClock, IcPin, IcUser } from "./icons";
import {
  STATUS_TONE,
  bookingDateISO,
  childLabel,
  createdAtLabel,
  dateBlock,
  timeLabel,
} from "./bookingRecord";
import { FeedbackWidget } from "../FeedbackWidget";
import { DirectRequestModal } from "@/components/direct/DirectRequestModal";
import styles from "../bookings.module.css";

type Props = {
  booking: ParentBookingItem;
};

export function BookingRecordCard({ booking }: Props) {
  const [hasFeedback, setHasFeedback] = useState(booking.hasFeedback);
  const [feedbackRating, setFeedbackRating] = useState(booking.feedbackRating);
  const [directOpen, setDirectOpen] = useState(false);

  const { status, display } = booking;
  const tone = STATUS_TONE[status];
  const { day, month } = dateBlock(bookingDateISO(booking));

  const isPending = status === BookingStatus.NEW;
  const isConfirmed = status === BookingStatus.CONFIRMED;
  const isCompleted = status === BookingStatus.COMPLETED;
  const isExpired = status === BookingStatus.EXPIRED;
  const isCancelled =
    status === BookingStatus.REJECTED || status === BookingStatus.CANCELLED || isExpired;

  const publicHref = booking.publicHref;
  const phoneHref = booking.organizerPhone
    ? `tel:${booking.organizerPhone.replace(/[^\d+]/g, "")}`
    : null;
  const messageHref = booking.organizerTelegramUrl ?? booking.organizerInstagramUrl;
  const websiteHref = booking.organizerWebsite && /^https?:\/\//i.test(booking.organizerWebsite)
    ? booking.organizerWebsite
    : null;
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

  const chatHref = booking.directThreadId ? `/me/direct/${booking.directThreadId}` : null;
  // Expired request: let the customer write to the organizer themselves, if platform policy allows.
  const canWriteOrganizer = isExpired && !chatHref && booking.directAvailable && booking.directPublicationType;
  const directRef = booking.directPublicationType === "OFFER" && booking.offerId
    ? { publicationType: "OFFER" as const, offerId: booking.offerId }
    : booking.directPublicationType === "EVENT" && booking.activityId
      ? { publicationType: "EVENT" as const, activityId: booking.activityId }
      : booking.directPublicationType === "PLACE" && booking.placeId
        ? { publicationType: "PLACE" as const, placeId: booking.placeId }
        : null;

  const time = timeLabel(booking);
  const child = childLabel(booking);
  const venue = booking.businessName;

  return (
    <Reveal
      as="article"
      className={`${styles.recCard} ${isCancelled ? styles.recCardMuted : ""}`.trim()}
    >
      <div className={styles.recMain}>
        {/* Дата */}
        <div className={styles.recDate}>
          <span className={styles.recDay}>{day}</span>
          <span className={styles.recMonth}>{month}</span>
        </div>

        {/* Тело */}
        <div className={styles.recBody}>
          <span className={styles.recKicker}>● {display.typeLabel}</span>
          {publicHref ? (
            <Link href={publicHref} className={styles.recTitle}>
              {display.title}
            </Link>
          ) : (
            <h3 className={styles.recTitle}>{display.title}</h3>
          )}
          <div className={styles.recMeta}>
            {venue ? (
              <span>
                <IcPin /> {venue}
              </span>
            ) : null}
            {time ? (
              <span>
                <IcClock /> {time}
              </span>
            ) : null}
            {child ? (
              <span>
                <IcUser /> {child}
              </span>
            ) : null}
          </div>
          {createdAtLabel(booking.createdAt) ? (
            <div className={styles.recCode}>{createdAtLabel(booking.createdAt)}</div>
          ) : null}
        </div>

        {/* Правый рельс */}
        <div className={styles.recRail}>
          <span className={styles.statusPill} style={{ background: tone.bg, color: tone.color }}>
            {tone.dot} {tone.label}
          </span>
          {publicHref ? (
            <div className={styles.recActions}>
              <Link href={publicHref} className={styles.railBtn}>
                Открыть <IcArrow />
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {/* Детали по статусу */}
      {isPending ? (
        <div className={styles.recDetails}>
          <p className={styles.detailsNote}>Ожидаем подтверждения от организатора</p>
        </div>
      ) : null}

      {isExpired ? (
        <div className={styles.recDetails}>
          <p className={styles.detailsNote}>Организатор не ответил</p>
          {phoneHref || messageHref || canWriteOrganizer ? (
            <div className={styles.contactActions}>
              {canWriteOrganizer && directRef ? (
                <button type="button" className={styles.chip} onClick={() => setDirectOpen(true)}>
                  <MessageCircle size={15} /> Написать организатору
                </button>
              ) : null}
              {phoneHref ? (
                <a href={phoneHref} className={styles.chip}>
                  <Phone size={15} /> Позвонить
                </a>
              ) : null}
              {messageHref ? (
                <a href={messageHref} target="_blank" rel="noopener noreferrer" className={styles.chip}>
                  <MessageCircle size={15} /> Написать
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {chatHref ? (
        <div className={styles.recDetails}>
          <div className={styles.contactActions}>
            <Link href={chatHref} className={styles.chip}>
              <MessageCircle size={15} /> Чат с организатором
            </Link>
          </div>
        </div>
      ) : null}

      {canWriteOrganizer && directRef ? (
        <DirectRequestModal
          open={directOpen}
          onOpenChange={setDirectOpen}
          publicationRef={directRef}
          publicationTitle={display.title}
          brandName={booking.organizerName ?? booking.businessName ?? "Организатор"}
          bookingRequestId={booking.id}
        />
      ) : null}

      {(isConfirmed || (isPending && Boolean(booking.campShiftId))) ? (
        <div className={styles.recDetails}>
          <div className={styles.contactCard}>
            <p className={styles.contactLabel}>Контакты для связи</p>
            <p className={styles.contactName}>
              {booking.organizerName ?? booking.businessName ?? "Организатор"}
            </p>
            {booking.organizerPhone ? (
              <p className={styles.contactRow}>{booking.organizerPhone}</p>
            ) : null}
            {booking.address ? <p className={styles.contactRow}>{booking.address}</p> : null}
            {booking.organizerWebsite ? (
              <p className={styles.contactRow}>
                {websiteHref ? (
                  <a href={websiteHref} target="_blank" rel="noopener noreferrer">{booking.organizerWebsite}</a>
                ) : booking.organizerWebsite}
              </p>
            ) : null}
            <p className={styles.contactHint}>
              {isPending
                ? "Заявка отправлена, ожидаем ответа организатора. Контакты предложения доступны для уточнения деталей; запись пока не подтверждена."
                : "Визит подтверждён организатором. Если планы изменились — свяжитесь с ним заранее."}
            </p>
            {hasContacts ? (
              <div className={styles.contactActions}>
                {phoneHref ? (
                  <a href={phoneHref} className={styles.chip}>
                    <Phone size={15} /> Позвонить
                  </a>
                ) : null}
                {messageHref ? (
                  <a
                    href={messageHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.chip}
                  >
                    <MessageCircle size={15} /> Написать
                  </a>
                ) : null}
                {routeHref ? (
                  <a
                    href={routeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.chip}
                  >
                    <Route size={15} /> Маршрут
                  </a>
                ) : null}
              </div>
            ) : publicHref ? (
              <p className={styles.contactHint}>
                Контакты не указаны. Откройте запись, чтобы посмотреть детали.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {isCompleted && !hasFeedback ? (
        <div className={styles.recDetails}>
          <p className={styles.detailsNote} style={{ marginBottom: 12 }}>
            Посещение завершено — поделитесь впечатлением
          </p>
          <FeedbackWidget
            bookingId={booking.id}
            onSubmitted={(rating) => {
              setHasFeedback(true);
              setFeedbackRating(rating);
            }}
          />
        </div>
      ) : null}

      {isCompleted && hasFeedback && feedbackRating != null ? (
        <div className={styles.recDetails}>
          <span className={styles.ratingRow}>
            <Star size={15} /> Вы оценили на {feedbackRating} из 5
          </span>
        </div>
      ) : null}
    </Reveal>
  );
}
