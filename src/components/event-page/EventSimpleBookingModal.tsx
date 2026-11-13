"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RS, RsChip, RsChipRow, RsConfirmBar, RsDateCards, RsInput, RsSection, RsSuccess, RsTextarea, RequestSheetFrame } from "@/components/request/requestSheetKit";
import type { EventSimpleBookingData, EventBookingSlot } from "@/lib/event/eventPageTypes";
import { BookingParticipantsField } from "./BookingParticipantsField";
import {
  INITIAL_PARTICIPANTS_DRAFT,
  participantsDraftToPayload,
  validateParticipantsDraft,
  type ParticipantsDraft,
} from "./participantsDraft";
import { InternationalPhoneInput } from "@/components/phone/InternationalPhoneInput";
import { pluralRu } from "@/lib/date/dateKey";

/* ─────────────── validation ─────────────── */
const schema = z.object({
  customerName: z.string().min(2, "Введите имя (минимум 2 символа)").max(120),
  customerPhone: z
    .string()
    .min(7, "Введите телефон")
    .max(30)
    .regex(/^\+?[\d\s\-().]{7,30}$/, "Некорректный формат"),
  comment: z.string().max(500),
});
type FormValues = z.infer<typeof schema>;
type Phase = "form" | "submitting" | "success" | "error";

/* ─────────────── helpers ─────────────── */
const RU_MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const RU_DAYS_SHORT   = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];

type DateGroup = {
  isoDate: string;
  dow: string;
  d: string;
  m: string;
  slots: EventBookingSlot[];
};

function groupSlotsByDate(slots: EventBookingSlot[]): DateGroup[] {
  const map = new Map<string, DateGroup>();
  for (const slot of slots) {
    if (!map.has(slot.isoDate)) {
      const dt = new Date(slot.isoDate + "T12:00:00");
      map.set(slot.isoDate, {
        isoDate: slot.isoDate,
        dow: RU_DAYS_SHORT[dt.getDay()] ?? "",
        d: String(dt.getDate()),
        m: RU_MONTHS_SHORT[dt.getMonth()] ?? "",
        slots: [],
      });
    }
    map.get(slot.isoDate)!.slots.push(slot);
  }
  return Array.from(map.values());
}

type SlotSeats = Record<string, { capacity: number; remaining: number }>;

function seatsLabel(seats: SlotSeats[string]) {
  return seats.remaining > 0
    ? `Осталось ${seats.remaining} ${pluralRu(seats.remaining, ["место", "места", "мест"])}`
    : "Мест на это время нет";
}

function slotTimeLabel(slot: EventBookingSlot) {
  return slot.endTime ? `${slot.startTime}–${slot.endTime}` : slot.startTime;
}

/* ─────────────── main component ─────────────── */
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTitle: string;
  eventCategory?: string;
  priceLabel?: string;
  /** Постер и площадка для карточки с названием в шапке окна (как в окне «Сохранить»). */
  eventImageUrl?: string | null;
  eventVenue?: string | null;
  booking: EventSimpleBookingData;
  initialSessionId?: string | null;
  isAuthenticated?: boolean;
  onBooked?: (bookingId: string) => void;
};

export function EventSimpleBookingModal({
  open, onOpenChange,
  eventTitle, eventCategory, priceLabel, eventImageUrl, eventVenue,
  booking, initialSessionId, isAuthenticated = false, onBooked,
}: Props) {
  const slots = useMemo(() => booking.slots ?? [], [booking.slots]);
  // «Оставить заявку»: заявка на участие без выбора времени — другие слова, чем у записи на слот.
  const isRequest = booking.label === "Оставить заявку";
  const isPrebooking = booking.label === "Предварительная запись";
  const dateGroups = useMemo(() => groupSlotsByDate(slots), [slots]);

  const [phase, setPhase]       = useState<Phase>("form");
  const [apiError, setApiError] = useState<string | null>(null);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [dateId, setDateId] = useState("");
  const [timeId, setTimeId] = useState("");
  const [participants, setParticipants] = useState<ParticipantsDraft>(INITIAL_PARTICIPANTS_DRAFT);
  const [participantErrors, setParticipantErrors] = useState<Record<string, string>>({});
  const [seatsBySlot, setSeatsBySlot] = useState<SlotSeats>({});
  const inFlight = useRef(false);
  const initialSlot = slots.find((slot) => slot.id === initialSessionId);

  const selectedDate = dateGroups.find((group) => group.isoDate === (dateId || initialSlot?.isoDate)) ?? dateGroups[0];
  const selectedSlot = selectedDate?.slots.find((slot) => slot.id === (timeId || initialSlot?.id)) ?? selectedDate?.slots[0];

  const selectedSeats = selectedSlot ? seatsBySlot[selectedSlot.id] : undefined;

  // В режиме time-slots нужен выбранный слот; в simple-booking слотов нет → сразу valid
  const valid = (slots.length === 0 || Boolean(selectedSlot)) && selectedSeats?.remaining !== 0;

  // Seats left are fetched when the window opens, not with the page: they change on every booking.
  const hasTimedSlots = slots.some((slot) => slot.startTime);
  useEffect(() => {
    if (!open || !hasTimedSlots) return;
    const controller = new AbortController();
    fetch(`/api/public/events/${encodeURIComponent(booking.activityId)}/slot-availability`, { signal: controller.signal, cache: "no-store" })
      .then((res) => (res.ok ? res.json() as Promise<{ slots?: SlotSeats }> : null))
      .then((json) => { if (json?.slots) setSeatsBySlot(json.slots); })
      .catch(() => { /* seats are informational; the server re-checks on submit */ });
    return () => controller.abort();
  }, [open, hasTimedSlots, booking.activityId]);

  const { register, control, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { customerName: "", customerPhone: "", comment: "" },
  });

  async function onSubmit(values: FormValues) {
    if (!valid || inFlight.current) return;
    const childErrors = validateParticipantsDraft(participants);
    setParticipantErrors(childErrors);
    if (Object.keys(childErrors).length > 0) return;
    inFlight.current = true;
    setPhase("submitting");
    setApiError(null);
    try {
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          publicationType: "EVENT",
          publicationId: booking.activityId,
          selectedSessionId: selectedSlot?.startTime ? selectedSlot.id : undefined,
          requestedDate: selectedSlot?.isoDate ?? booking.date,
          requestedTime: selectedSlot?.startTime || booking.time,
          customerName: values.customerName.trim(),
          customerPhone: values.customerPhone.trim(),
          customerComment: values.comment.trim() || undefined,
          ...participantsDraftToPayload(participants),
        }),
      });
      const json = await res.json() as { error?: string; id?: string };
      if (!res.ok) { setApiError(json.error ?? "Не удалось отправить заявку."); setPhase("error"); return; }
      setCreatedBookingId(json.id ?? null);
      setPhase("success");
      if (json.id) onBooked?.(json.id);
    } catch {
      setApiError("Ошибка соединения. Попробуйте ещё раз.");
      setPhase("error");
    } finally {
      inFlight.current = false;
    }
  }

  function handleClose(val: boolean) {
    if (!val && inFlight.current) return;
    if (!val) {
      reset(); setPhase("form"); setApiError(null); setCreatedBookingId(null);
      setDateId("");
      setTimeId("");
      setParticipants(INITIAL_PARTICIPANTS_DRAFT);
      setParticipantErrors({});
    }
    onOpenChange(val);
  }

  const submitting = phase === "submitting";
  const summary = selectedDate
    ? `${selectedDate.dow.toLowerCase()}, ${selectedDate.d} ${selectedDate.m}${selectedSlot?.startTime ? ` · ${slotTimeLabel(selectedSlot)}` : ""}`
    : (isRequest || isPrebooking ? "Без выбора времени" : (eventCategory ?? "Запись на событие"));

  return (
    <RequestSheetFrame
      open={open}
      onOpenChange={handleClose}
      ticket={{ title: eventTitle, imageUrl: eventImageUrl ?? null, venue: eventVenue ?? null, priceLabel: priceLabel ?? null }}
      heading={phase === "success" ? <>Заявка получена</> : isRequest ? <>Оставить заявку</> : isPrebooking ? <>Предварительная запись</> : <>Записаться на событие</>}
    >
      {phase === "success" ? (
        <RsSuccess
          title="Заявка принята"
          text="Она ожидает подтверждения организатора. Это ещё не подтверждённая бронь."
        >
          {createdBookingId && (
            <p className="my-3 text-center text-sm text-stone-600">
              Номер заявки: <span className="font-semibold">{createdBookingId}</span>
            </p>
          )}
          {isAuthenticated ? (
            <Link href="/me/bookings" className="mb-3 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-stone-900 text-[15px] font-semibold text-white">
              Мои записи
            </Link>
          ) : (
            <p className="mb-3 text-center text-sm text-stone-600">
              Заявка создана без входа в аккаунт, поэтому она не появится в плане, в «Моих записях» и на странице события. Сохраните номер заявки — организатор свяжется с вами по телефону. Чтобы будущие записи отображались в плане и на странице события, войдите в аккаунт перед записью.
            </p>
          )}
          <button type="button" onClick={() => handleClose(false)} className="inline-flex min-h-12 w-full items-center justify-center rounded-full border text-[15px] font-semibold" style={{ borderColor: RS.line2 }}>
            Закрыть
          </button>
        </RsSuccess>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {dateGroups.length > 0 ? (
            <>
              <RsSection label="Дата">
                <RsDateCards
                  items={dateGroups.map((dg) => ({ key: dg.isoDate, weekday: dg.dow.toLowerCase(), day: Number(dg.d), month: dg.m }))}
                  value={selectedDate?.isoDate ?? ""}
                  onChange={(iso) => {
                    setDateId(iso);
                    setTimeId(dateGroups.find((g) => g.isoDate === iso)?.slots[0]?.id ?? "");
                  }}
                />
              </RsSection>
              {selectedSlot?.startTime && selectedDate ? (
                <RsSection label="Время">
                  <RsChipRow>
                    {selectedDate.slots.map((slot) => (
                      <RsChip key={slot.id} active={slot.id === selectedSlot?.id} onClick={() => setTimeId(slot.id)}>
                        {slotTimeLabel(slot)}
                      </RsChip>
                    ))}
                  </RsChipRow>
                  {selectedSeats ? (
                    <p aria-live="polite" className={`m-0 mt-2 text-xs font-medium ${selectedSeats.remaining === 0 ? "text-[#B3261E]" : "text-[rgba(20,18,16,.55)]"}`}>
                      {seatsLabel(selectedSeats)}
                    </p>
                  ) : null}
                </RsSection>
              ) : null}
            </>
          ) : null}

          <RsSection label="Имя" error={errors.customerName?.message}>
            <RsInput placeholder="Как вас зовут" autoComplete="name" invalid={!!errors.customerName} {...register("customerName")} />
          </RsSection>
          <RsSection label="Телефон" error={errors.customerPhone?.message}>
            <Controller
              control={control}
              name="customerPhone"
              render={({ field }) => (
                <InternationalPhoneInput
                  id="booking-phone"
                  value={field.value}
                  onChange={field.onChange}
                  aria-invalid={!!errors.customerPhone}
                  className="[&_.PhoneInput]:!h-[52px] [&_.PhoneInput]:!rounded-[14px] [&_.PhoneInput]:!border-[rgba(20,18,16,.10)] [&_.PhoneInput]:!bg-[#FAF7F1] [&_.PhoneInput]:!px-4 [&_.PhoneInputInput]:!text-[15px] [&_.PhoneInput--invalid]:!border-[#B3261E] [&.international-phone-field--invalid_.PhoneInput]:!border-[#B3261E]"
                />
              )}
            />
          </RsSection>
          <BookingParticipantsField
            value={participants}
            onChange={setParticipants}
            isAuthenticated={isAuthenticated}
            ageRule={booking.ageRule ?? null}
            errors={participantErrors}
          />
          <RsSection label="Комментарий" hint="необязательно" error={errors.comment?.message}>
            <RsTextarea rows={3} placeholder="Вопросы организатору…" {...register("comment")} />
          </RsSection>
          {apiError ? <p role="alert" className="m-0 mb-3 rounded-2xl bg-[#FDECEA] px-4 py-3 text-sm font-semibold text-[#8C2A20]">{apiError}</p> : null}

          <RsConfirmBar
            summary={summary}
            label={selectedSlot ? "выбрано" : isRequest ? "заявка на участие" : "запись"}
            actionLabel={isRequest || isPrebooking ? "Отправить заявку" : "Записаться"}
            onAction={() => void handleSubmit(onSubmit)()}
            busy={submitting}
            disabled={!valid}
            note="Организатор свяжется для подтверждения"
          />
        </form>
      )}
    </RequestSheetFrame>
  );
}
