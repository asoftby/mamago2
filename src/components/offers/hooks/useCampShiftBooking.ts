"use client";

import { useState } from "react";
import type { ShiftCtaContext } from "@/lib/offer/offerPageTypes";

export type BookingFormValues = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  childName: string;
  childAge: string;
  comment: string;
};

export type BookingPhase = "form" | "submitting" | "success" | "error";

export interface UseCampShiftBookingReturn {
  phase: BookingPhase;
  apiError: string | null;
  submit: (offerId: string, shift: ShiftCtaContext, values: BookingFormValues) => Promise<void>;
  reset: () => void;
}

/**
 * Хук инкапсулирует логику отправки заявки на смену лагеря.
 * Компонент формы остаётся чистым — только UI.
 */
export function useCampShiftBooking(): UseCampShiftBookingReturn {
  const [phase, setPhase] = useState<BookingPhase>("form");
  const [apiError, setApiError] = useState<string | null>(null);

  const submit = async (
    offerId: string,
    shift: ShiftCtaContext,
    values: BookingFormValues,
  ) => {
    setPhase("submitting");
    setApiError(null);

    try {
      const res = await fetch("/api/public/bookings/camp-shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          offerId,
          campShiftId: shift.shiftId,
          customerName: values.customerName.trim(),
          customerPhone: values.customerPhone.trim(),
          customerEmail: values.customerEmail.trim() || undefined,
          childName: values.childName.trim() || undefined,
          childAge: values.childAge ? parseInt(values.childAge, 10) : undefined,
          comment: values.comment.trim() || undefined,
        }),
      });

      const json = (await res.json()) as { ok?: boolean; error?: string; bookingId?: string };

      if (!res.ok || !json.ok) {
        setApiError(json.error ?? "Не удалось отправить заявку. Попробуйте ещё раз.");
        setPhase("error");
        return;
      }

      setPhase("success");
    } catch {
      setApiError("Нет соединения с сервером. Проверьте интернет и попробуйте снова.");
      setPhase("error");
    }
  };

  const reset = () => {
    setPhase("form");
    setApiError(null);
  };

  return { phase, apiError, submit, reset };
}
