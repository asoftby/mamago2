"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, CheckCircle2, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import type { ShiftCtaContext } from "@/lib/offer/offerPageTypes";
import {
  useCampShiftBooking,
  type BookingFormValues,
} from "./hooks/useCampShiftBooking";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  customerName: z.string().min(2, "Введите имя (минимум 2 символа)").max(120),
  customerPhone: z
    .string()
    .min(7, "Введите телефон")
    .max(30)
    .regex(/^\+?[\d\s\-().]{7,30}$/, "Некорректный формат телефона"),
  customerEmail: z.string().max(200).refine(
    (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "Некорректный email",
  ),
  childName: z.string().max(120),
  childAge: z.string().refine(
    (v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 18),
    "Возраст от 0 до 18 лет",
  ),
  comment: z.string().max(1000),
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface CampShiftBookingOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: string;
  offerTitle: string;
  shift: ShiftCtaContext | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CampShiftBookingOverlay({
  open,
  onOpenChange,
  offerId,
  offerTitle,
  shift,
}: CampShiftBookingOverlayProps) {
  const { phase, apiError, submit, reset } = useCampShiftBooking();

  const {
    register,
    handleSubmit,
    setError,
    reset: resetForm,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      childName: "",
      childAge: "",
      comment: "",
    },
  });

  // Сбрасываем форму при закрытии
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        reset();
        resetForm();
      }, 300); // после анимации закрытия
      return () => clearTimeout(timer);
    }
  }, [open, reset, resetForm]);

  // Маппим API-ошибку в поле формы если возможно
  useEffect(() => {
    if (phase === "error" && apiError) {
      if (apiError.toLowerCase().includes("телефон")) {
        setError("customerPhone", { type: "server", message: apiError });
      }
    }
  }, [phase, apiError, setError]);

  const onSubmit = handleSubmit(async (values) => {
    if (!shift) return;
    await submit(offerId, shift, values);
  });

  const isSubmitting = phase === "submitting";
  const isSuccess = phase === "success";

  const dateLabel =
    shift?.dateFrom && shift?.dateTo
      ? `${shift.dateFrom} — ${shift.dateTo}`
      : shift?.dateFrom ?? shift?.dateTo ?? null;

  // ── Subtitle для overlay ──
  const subtitle = shift ? (
    <div className="flex flex-wrap items-center gap-2 text-[13px] text-neutral-500">
      {shift.title && <span className="font-medium text-neutral-700">{shift.title}</span>}
      {dateLabel && (
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          {dateLabel}
        </span>
      )}
      {shift.ageRange && (
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5 shrink-0" />
          {shift.ageRange}
        </span>
      )}
      {shift.price && (
        <span className="font-semibold text-neutral-800">{shift.price}</span>
      )}
    </div>
  ) : null;

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      a11yTitle="Запись на смену лагеря"
      variant="framed"
      title="Записаться на смену"
      subtitle={subtitle}
      heightMode="tall"
      dialogContentClassName="max-w-lg"
      footer={
        !isSuccess ? (
          <div className="px-5 py-4">
            <Button
              type="submit"
              form="camp-shift-booking-form"
              disabled={isSubmitting}
              className="h-12 w-full rounded-2xl bg-[#EF8759] text-[15px] font-bold text-white hover:bg-[#e07848] disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Отправляем…
                </span>
              ) : (
                "Отправить заявку"
              )}
            </Button>
          </div>
        ) : null
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {isSuccess ? (
          <SuccessScreen offerTitle={offerTitle} onClose={() => onOpenChange(false)} />
        ) : (
          <form
            id="camp-shift-booking-form"
            onSubmit={onSubmit}
            noValidate
            className="space-y-4 px-5 py-4"
          >
            {/* API error banner */}
            {phase === "error" && apiError && !apiError.toLowerCase().includes("телефон") && (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700"
              >
                {apiError}
              </div>
            )}

            {/* ── Контактные данные ── */}
            <fieldset className="space-y-3">
              <legend className="text-[12px] font-semibold uppercase tracking-wider text-gray-400">
                Ваши контакты
              </legend>

              <Field
                label="Имя *"
                error={errors.customerName?.message}
                htmlFor="booking-name"
              >
                <Input
                  id="booking-name"
                  placeholder="Как к вам обращаться"
                  autoComplete="name"
                  autoFocus
                  disabled={isSubmitting}
                  className={inputCls(!!errors.customerName)}
                  {...register("customerName")}
                />
              </Field>

              <Field
                label="Телефон *"
                error={errors.customerPhone?.message}
                htmlFor="booking-phone"
              >
                <Input
                  id="booking-phone"
                  type="tel"
                  placeholder="+375 29 000 00 00"
                  autoComplete="tel"
                  disabled={isSubmitting}
                  className={inputCls(!!errors.customerPhone)}
                  {...register("customerPhone")}
                />
              </Field>

              <Field
                label="Email"
                error={errors.customerEmail?.message}
                htmlFor="booking-email"
              >
                <Input
                  id="booking-email"
                  type="email"
                  placeholder="для подтверждения (необязательно)"
                  autoComplete="email"
                  disabled={isSubmitting}
                  className={inputCls(!!errors.customerEmail)}
                  {...register("customerEmail")}
                />
              </Field>
            </fieldset>

            {/* ── Данные ребёнка ── */}
            <fieldset className="space-y-3">
              <legend className="text-[12px] font-semibold uppercase tracking-wider text-gray-400">
                Данные ребёнка
              </legend>

              <Field
                label="Имя ребёнка"
                error={errors.childName?.message}
                htmlFor="booking-child-name"
              >
                <Input
                  id="booking-child-name"
                  placeholder="Имя ребёнка"
                  disabled={isSubmitting}
                  className={inputCls(!!errors.childName)}
                  {...register("childName")}
                />
              </Field>

              <Field
                label="Возраст ребёнка"
                error={errors.childAge?.message}
                htmlFor="booking-child-age"
              >
                <Input
                  id="booking-child-age"
                  type="number"
                  min={0}
                  max={18}
                  placeholder="лет"
                  disabled={isSubmitting}
                  className={cn(inputCls(!!errors.childAge), "w-28")}
                  {...register("childAge")}
                />
              </Field>
            </fieldset>

            {/* ── Комментарий ── */}
            <Field
              label="Комментарий"
              error={errors.comment?.message}
              htmlFor="booking-comment"
            >
              <textarea
                id="booking-comment"
                rows={3}
                placeholder="Вопросы, пожелания…"
                disabled={isSubmitting}
                className={cn(
                  "w-full resize-none rounded-xl border px-3 py-2.5 text-[14px] text-gray-900 placeholder:text-gray-400",
                  "focus:outline-none focus:ring-2 focus:ring-[#EF8759]/40",
                  "disabled:opacity-50",
                  errors.comment
                    ? "border-red-300 bg-red-50/30"
                    : "border-gray-200 bg-white",
                )}
                {...register("comment")}
              />
            </Field>

            <p className="text-[12px] text-gray-400">
              * Обязательные поля. Нажимая «Отправить заявку», вы соглашаетесь
              с обработкой персональных данных.
            </p>
          </form>
        )}
      </div>
    </ResponsiveOverlay>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({
  offerTitle,
  onClose,
}: {
  offerTitle: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
      </div>

      <div className="space-y-2">
        <h3 className="text-[20px] font-bold text-gray-900">Заявка отправлена!</h3>
        <p className="text-[15px] text-gray-500">
          Организатор свяжется с вами в ближайшее время для подтверждения записи.
        </p>
      </div>

      <div className="mt-2 w-full max-w-xs space-y-3">
        <Button
          type="button"
          onClick={onClose}
          className="h-11 w-full rounded-2xl bg-[#EF8759] text-[14px] font-bold text-white hover:bg-[#e07848]"
        >
          Закрыть
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="w-full text-[13px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
        >
          Добавить в план — скоро
        </button>
      </div>
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-gray-700">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-[12px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return cn(
    "h-11 rounded-xl border text-[14px]",
    "focus-visible:ring-2 focus-visible:ring-[#EF8759]/40 focus-visible:ring-offset-0",
    hasError
      ? "border-red-300 bg-red-50/30 focus-visible:ring-red-300/40"
      : "border-gray-200 bg-white",
  );
}
