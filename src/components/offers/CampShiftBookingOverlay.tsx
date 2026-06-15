"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  Phone,
  SmilePlus,
  SunMedium,
  Tent,
  Trees,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ShiftCtaContext } from "@/lib/offer/offerPageTypes";
import {
  useCampShiftBooking,
  type BookingFormValues,
} from "./hooks/useCampShiftBooking";

const schema = z.object({
  selectedChildId: z.string().optional(),
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
  childName: z.string().min(2, "Укажите имя ребёнка").max(120),
  childAge: z.string().refine(
    (v) => !!v && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 18,
    "Выберите возраст ребёнка",
  ),
  comment: z.string().max(1000),
});

type BookingPrefillResponse = {
  authenticated: boolean;
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
    phoneVerified: boolean;
  } | null;
  children: Array<{
    id: string;
    name: string;
    birthDate: string | null;
    age: number | null;
  }>;
};

interface CampShiftBookingOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: string;
  offerTitle: string;
  shift: ShiftCtaContext | null;
  shifts?: ShiftCtaContext[];
}

export function CampShiftBookingOverlay({
  open,
  onOpenChange,
  offerId,
  offerTitle,
  shift,
  shifts = [],
}: CampShiftBookingOverlayProps) {
  const { phase, apiError, submit, reset } = useCampShiftBooking();
  const [prefill, setPrefill] = useState<BookingPrefillResponse | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillLoadedForSession, setPrefillLoadedForSession] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(shift?.shiftId ?? null);
  const [shiftPickerOpen, setShiftPickerOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    reset: resetForm,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      selectedChildId: "",
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      childName: "",
      childAge: "",
      comment: "",
    },
  });

  const selectedChildId = useWatch({
    control,
    name: "selectedChildId",
  });

  const shiftOptions = useMemo(() => {
    if (shifts.length > 0) return shifts;
    return shift ? [shift] : [];
  }, [shift, shifts]);

  const defaultShiftId = shift?.shiftId ?? shiftOptions[0]?.shiftId ?? null;

  const selectedShift = useMemo(() => {
    const effectiveShiftId = selectedShiftId ?? defaultShiftId;
    if (!effectiveShiftId) return shiftOptions[0] ?? null;
    return shiftOptions.find((item) => item.shiftId === effectiveShiftId) ?? shiftOptions[0] ?? null;
  }, [defaultShiftId, selectedShiftId, shiftOptions]);

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        reset();
        resetForm();
        setPrefillLoadedForSession(false);
        setPrefill(null);
        setSelectedShiftId(null);
        setShiftPickerOpen(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, reset, resetForm]);

  useEffect(() => {
    if (!open || prefillLoadedForSession) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setPrefillLoading(true);
      }
    });

    fetch("/api/public/bookings/camp-shift/prefill", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("prefill_failed");
        return (await res.json()) as BookingPrefillResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setPrefill(data);

        if (data.user?.displayName) {
          setValue("customerName", data.user.displayName, { shouldDirty: false });
        }
        if (data.user?.email) {
          setValue("customerEmail", data.user.email, { shouldDirty: false });
        }
        if (data.user?.phoneVerified && data.user.phone) {
          setValue("customerPhone", data.user.phone, { shouldDirty: false });
        }
        if (data.children.length === 1) {
          const child = data.children[0];
          setValue("selectedChildId", child.id, { shouldDirty: false });
          setValue("childName", child.name, { shouldDirty: false });
          setValue("childAge", child.age != null ? String(child.age) : "", {
            shouldDirty: false,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrefill({ authenticated: false, user: null, children: [] });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPrefillLoading(false);
          setPrefillLoadedForSession(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, prefillLoadedForSession, setValue]);

  useEffect(() => {
    if (phase === "error" && apiError && apiError.toLowerCase().includes("телефон")) {
      setError("customerPhone", { type: "server", message: apiError });
    }
  }, [phase, apiError, setError]);

  useEffect(() => {
    if (!selectedChildId || !prefill?.children?.length) return;
    const child = prefill.children.find((item) => item.id === selectedChildId);
    if (!child) return;
    setValue("childName", child.name, { shouldDirty: true });
    setValue("childAge", child.age != null ? String(child.age) : "", {
      shouldDirty: true,
    });
  }, [prefill?.children, selectedChildId, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    if (!selectedShift) return;
    await submit(offerId, selectedShift, values);
  });

  const isSubmitting = phase === "submitting";
  const isSuccess = phase === "success";

  const dateLabel =
    selectedShift?.dateFrom && selectedShift?.dateTo
      ? `${selectedShift.dateFrom} — ${selectedShift.dateTo}`
      : selectedShift?.dateFrom ?? selectedShift?.dateTo ?? null;

  const availableChildren = prefill?.children ?? [];
  const hasChildSelector = availableChildren.length > 0;
  const ageOptions = useMemo(
    () => Array.from({ length: 19 }, (_, index) => index),
    [],
  );

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      a11yTitle="Запись на смену лагеря"
      variant="framed"
      title={null}
      subtitle={null}
      heightMode="tall"
      dialogContentClassName="max-w-4xl overflow-hidden p-0"
      sheetContentClassName="px-0"
      bodyClassName="bg-[linear-gradient(180deg,#fffdfa_0%,#ffffff_100%)]"
      footer={
        !isSuccess ? (
          <div className="space-y-2 px-5 py-4 sm:px-8">
            <Button
              type="submit"
              form="camp-shift-booking-form"
              disabled={isSubmitting || prefillLoading}
              className="h-14 w-full rounded-[18px] bg-[#EF8759] text-[17px] font-bold text-white hover:bg-[#e07848] disabled:opacity-60"
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
            <p className="text-center text-[12px] leading-5 text-neutral-400">
              Нажимая кнопку, вы соглашаетесь на обработку персональных данных.
            </p>
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
            className="space-y-6 px-5 py-5 sm:px-8 sm:py-7"
          >
            <div className="relative overflow-hidden rounded-[28px] border border-[#F3E6DB] bg-[linear-gradient(135deg,#fffdf9_0%,#fff7f1_100%)] px-5 py-5 sm:px-6">
              <div className="relative z-10 max-w-[58%] space-y-2 sm:max-w-[62%]">
                <h2 className="text-[28px] font-bold leading-tight text-neutral-950 sm:text-[32px]">
                  Запись на смену
                </h2>
                <p className="text-[15px] leading-6 text-neutral-500">
                  Быстро и просто — всего 1 минута!
                </p>
              </div>
              <div className="pointer-events-none absolute right-4 top-3 hidden items-end gap-2 text-[#EF8759] sm:flex">
                <Cloud className="mb-10 h-6 w-6 text-[#F7D7C2]" />
                <Trees className="h-20 w-20 text-[#E8A17D]" strokeWidth={1.6} />
                <Tent className="h-20 w-20 text-[#EF8759]" strokeWidth={1.7} />
                <Trees className="h-14 w-14 text-[#F1B390]" strokeWidth={1.6} />
                <SunMedium className="mb-12 h-8 w-8 text-[#F4B350]" strokeWidth={1.8} />
              </div>
            </div>

            {selectedShift ? (
              <div className="rounded-[22px] border border-[#F4E9DF] bg-[#FFFDF9] px-4 py-4 shadow-[0_18px_45px_-38px_rgba(239,135,89,0.55)] sm:px-5">
                <button
                  type="button"
                  onClick={() => {
                    if (shiftOptions.length > 1) {
                      setShiftPickerOpen((prev) => !prev);
                    }
                  }}
                  className={cn(
                    "flex w-full items-start gap-4 text-left",
                    shiftOptions.length > 1 && "cursor-pointer",
                  )}
                  aria-expanded={shiftOptions.length > 1 ? shiftPickerOpen : undefined}
                  aria-label={shiftOptions.length > 1 ? "Выбрать другую смену" : undefined}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF1E8] text-[#EF8759]">
                    <CalendarDays className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    {selectedShift.title ? (
                      <div className="text-[16px] font-semibold text-neutral-950 sm:text-[18px]">
                        {selectedShift.title}
                      </div>
                    ) : null}
                    {dateLabel ? (
                      <div className="text-[15px] text-neutral-500">{dateLabel}</div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3 text-[13px] text-neutral-500">
                      {selectedShift.ageRange ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {selectedShift.ageRange}
                        </span>
                      ) : null}
                      {selectedShift.price ? (
                        <span className="font-semibold text-[#D96534]">{selectedShift.price}</span>
                      ) : null}
                    </div>
                    {selectedShift.promotionDetails ? (
                      <div className="rounded-2xl border border-[#F2D8CA] bg-[#FFF3EB] px-3 py-2 text-[13px] leading-5 text-[#B5562D]">
                        {selectedShift.promotionDetails}
                      </div>
                    ) : null}
                  </div>
                  {shiftOptions.length > 1 ? (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#F0DDD0] bg-white text-[#EF8759]">
                      {shiftPickerOpen ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </div>
                  ) : null}
                </button>

                {shiftOptions.length > 1 && shiftPickerOpen ? (
                  <div className="mt-4 space-y-2 border-t border-[#F4E9DF] pt-4">
                    {shiftOptions.map((option) => {
                      const optionDateLabel =
                        option.dateFrom && option.dateTo
                          ? `${option.dateFrom} — ${option.dateTo}`
                          : option.dateFrom ?? option.dateTo ?? null;
                      const isActive = option.shiftId === selectedShift.shiftId;

                      return (
                        <button
                          key={option.shiftId}
                          type="button"
                          onClick={() => {
                            setSelectedShiftId(option.shiftId);
                            setShiftPickerOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-start justify-between gap-3 rounded-[18px] border px-4 py-3 text-left transition-colors",
                            isActive
                              ? "border-[#EF8759] bg-[#FFF4EC]"
                              : "border-[#F1E5DA] bg-white hover:border-[#EF8759]/40 hover:bg-[#FFFAF6]",
                          )}
                        >
                          <div className="min-w-0">
                            <div className="text-[15px] font-semibold text-neutral-950">
                              {option.title || "Смена"}
                            </div>
                            {optionDateLabel ? (
                              <div className="mt-0.5 text-[13px] text-neutral-500">
                                {optionDateLabel}
                              </div>
                            ) : null}
                            {option.promotionDetails ? (
                              <div className="mt-2 rounded-2xl border border-[#F2D8CA] bg-[#FFF7F1] px-3 py-2 text-[12px] leading-5 text-[#B5562D]">
                                {option.promotionDetails}
                              </div>
                            ) : null}
                          </div>
                          {option.price ? (
                            <span className="shrink-0 text-[13px] font-semibold text-[#D96534]">
                              {option.price}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            {phase === "error" && apiError && !apiError.toLowerCase().includes("телефон") ? (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700"
              >
                {apiError}
              </div>
            ) : null}

            <fieldset className="space-y-4">
              <legend className="text-[13px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                Ваши контакты
              </legend>

              <Field
                icon={<UserRound className="h-5 w-5" />}
                label="Как к вам обращаться? *"
                error={errors.customerName?.message}
                htmlFor="booking-name"
              >
                <Input
                  id="booking-name"
                  placeholder="Имя родителя или законного представителя"
                  autoComplete="name"
                  autoFocus
                  disabled={isSubmitting || prefillLoading}
                  className={inputCls(!!errors.customerName)}
                  {...register("customerName")}
                />
              </Field>

              <Field
                icon={<Phone className="h-5 w-5" />}
                label="Ваш телефон *"
                error={errors.customerPhone?.message}
                htmlFor="booking-phone"
                hint={
                  prefill?.user?.phoneVerified
                    ? "Подтянули подтверждённый номер из вашего профиля"
                    : "Мы свяжемся с вами по этому номеру"
                }
              >
                <Input
                  id="booking-phone"
                  type="tel"
                  placeholder="+375 29 000 00 00"
                  autoComplete="tel"
                  disabled={isSubmitting || prefillLoading}
                  className={inputCls(!!errors.customerPhone)}
                  {...register("customerPhone")}
                />
              </Field>

              <Field
                icon={<Mail className="h-5 w-5" />}
                label="Email (необязательно)"
                error={errors.customerEmail?.message}
                htmlFor="booking-email"
              >
                <Input
                  id="booking-email"
                  type="email"
                  placeholder="Для подтверждения заявки"
                  autoComplete="email"
                  disabled={isSubmitting || prefillLoading}
                  className={inputCls(!!errors.customerEmail)}
                  {...register("customerEmail")}
                />
              </Field>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-[30px] font-bold leading-tight text-neutral-950">
                О ребёнке
              </legend>

              {hasChildSelector ? (
                <Field
                  icon={<Users className="h-5 w-5" />}
                  label="Кого записываем?"
                  htmlFor="booking-child-select"
                  hint="Если ребёнок уже есть в профиле, данные подставятся автоматически"
                >
                  <Controller
                    name="selectedChildId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value || "manual"}
                        onValueChange={(value) => {
                          const nextValue = value === "manual" ? "" : value;
                          field.onChange(nextValue);
                          if (value === "manual") {
                            setValue("childName", "", { shouldDirty: true });
                            setValue("childAge", "", { shouldDirty: true });
                          }
                        }}
                        disabled={isSubmitting || prefillLoading}
                      >
                        <SelectTrigger
                          id="booking-child-select"
                          className={selectCls()}
                        >
                          <SelectValue placeholder="Выберите ребёнка" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="manual">Заполнить вручную</SelectItem>
                          {availableChildren.map((child) => (
                            <SelectItem key={child.id} value={child.id}>
                              {child.name}
                              {child.age != null ? ` · ${child.age} лет` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              ) : null}

              <Field
                icon={<SmilePlus className="h-5 w-5" />}
                label="Имя ребёнка *"
                error={errors.childName?.message}
                htmlFor="booking-child-name"
              >
                <Input
                  id="booking-child-name"
                  placeholder="Имя ребёнка"
                  disabled={isSubmitting || prefillLoading}
                  className={inputCls(!!errors.childName)}
                  {...register("childName")}
                />
              </Field>

              <Field
                icon={<CalendarDays className="h-5 w-5" />}
                label="Возраст ребёнка *"
                error={errors.childAge?.message}
                htmlFor="booking-child-age"
              >
                <Controller
                  name="childAge"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || ""}
                      onValueChange={field.onChange}
                      disabled={isSubmitting || prefillLoading}
                    >
                      <SelectTrigger
                        id="booking-child-age"
                        className={selectCls(!!errors.childAge)}
                      >
                        <SelectValue placeholder="Выберите возраст" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {ageOptions.map((age) => (
                          <SelectItem key={age} value={String(age)}>
                            {age} {age === 1 ? "год" : age >= 2 && age <= 4 ? "года" : "лет"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field
                icon={<MessageCircle className="h-5 w-5" />}
                label="Комментарий (необязательно)"
                error={errors.comment?.message}
                htmlFor="booking-comment"
              >
                <Textarea
                  id="booking-comment"
                  rows={4}
                  placeholder="Вопросы, пожелания, особенности ребёнка и др."
                  disabled={isSubmitting || prefillLoading}
                  className={textareaCls(!!errors.comment)}
                  {...register("comment")}
                />
              </Field>
            </fieldset>

            <div className="flex items-center justify-center gap-2 rounded-2xl bg-[#FFF7F1] px-4 py-3 text-center text-[13px] text-neutral-500">
              <Lock className="h-4 w-4 shrink-0 text-[#EF8759]" />
              Ваши данные защищены и не передаются третьим лицам.
            </div>
          </form>
        )}
      </div>
    </ResponsiveOverlay>
  );
}

function SuccessScreen({
  onClose,
}: {
  offerTitle: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF1E8]">
        <CheckCircle2 className="h-8 w-8 text-[#EF8759]" />
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
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  error,
  htmlFor,
  hint,
  children,
}: {
  icon?: ReactNode;
  label: string;
  error?: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[52px_minmax(0,1fr)] sm:gap-4">
      <div className="flex justify-center pt-2 text-[#EF8759]">
        {icon}
      </div>
      <label htmlFor={htmlFor} className="block space-y-2">
        <span className="text-[15px] font-medium text-neutral-900">{label}</span>
        {children}
        {error ? (
          <p role="alert" className="text-[12px] text-red-600">
            {error}
          </p>
        ) : null}
        {!error && hint ? <p className="text-[12px] text-neutral-400">{hint}</p> : null}
      </label>
    </div>
  );
}

function inputCls(hasError: boolean) {
  return cn(
    "h-14 rounded-[18px] border border-[#E7DDD5] bg-white px-4 text-[16px]",
    "placeholder:text-neutral-400 focus-visible:border-[#EF8759] focus-visible:ring-[#EF8759]/20",
    hasError ? "border-red-300 bg-red-50/30 focus-visible:ring-red-200" : "",
  );
}

function selectCls(hasError = false) {
  return cn(
    "h-14 w-full rounded-[18px] border border-[#E7DDD5] bg-white px-4 text-[16px]",
    "focus:border-[#EF8759] focus:ring-[#EF8759]/20",
    hasError ? "border-red-300 bg-red-50/30" : "",
  );
}

function textareaCls(hasError: boolean) {
  return cn(
    "min-h-[108px] rounded-[18px] border border-[#E7DDD5] bg-white px-4 py-3 text-[16px]",
    "placeholder:text-neutral-400 focus-visible:border-[#EF8759] focus-visible:ring-[#EF8759]/20",
    hasError ? "border-red-300 bg-red-50/30" : "",
  );
}
