"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, FileText, Plus, Trash2 } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UnpLookupField } from "@/components/business/UnpLookupField";
import { PhoneInputByMask } from "@/components/phone/PhoneInputByMask";
import { isValidE164Phone } from "@/lib/phone/e164";
import { formatPrice } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import { cn } from "@/lib/utils";

type TemplateSource = "MAMAGO" | "CLIENT";

type ServiceItem = {
  id: string;
  name: string;
  amount: number;
};

const STEPS = ["Шаблон", "Клиент", "Договор", "Услуги", "График"] as const;
const PREPAYMENT_PRESETS = [0, 30, 50, 70, 100] as const;
const PREPAYMENT_DUE_PRESETS = [
  { label: "Сегодня", days: 0 },
  { label: "+3 дня", days: 3 },
  { label: "+7 дней", days: 7 },
] as const;
const POSTPAYMENT_DUE_PRESETS = [
  { label: "+14 дней", days: 14 },
  { label: "+30 дней", days: 30 },
  { label: "+45 дней", days: 45 },
] as const;

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayIso(): string {
  return toLocalIsoDate(new Date());
}

function addDaysIso(baseIso: string, days: number): string {
  const [year, month, day] = baseIso.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return toLocalIsoDate(date);
}

function contractNumberFromDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(new Date(year, month - 1, day, 12, 0, 0, 0));
}

function parseAmount(raw: string): number | null {
  const normalized = raw.trim().replace(/\s+/g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function initialSignedAt() {
  return todayIso();
}

export function CreateContractWizard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);

  const [templateSource, setTemplateSource] = useState<TemplateSource>("MAMAGO");

  const [unp, setUnp] = useState("");
  const [clientName, setClientName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phoneE164, setPhoneE164] = useState("+375");
  const [egrStatus, setEgrStatus] = useState<{
    legalName: string | null;
    source: string | null;
  } | null>(null);

  const [signedAt, setSignedAt] = useState(initialSignedAt);
  const [contractNumber, setContractNumber] = useState(() =>
    contractNumberFromDate(initialSignedAt()),
  );
  const [contractNumberIsAuto, setContractNumberIsAuto] = useState(true);

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [serviceName, setServiceName] = useState("");
  const [serviceAmount, setServiceAmount] = useState("");

  const [prepaymentPercent, setPrepaymentPercent] = useState(30);
  const [customPrepayment, setCustomPrepayment] = useState("");
  const [prepaymentDueAt, setPrepaymentDueAt] = useState(initialSignedAt);
  const [postpaymentDueAt, setPostpaymentDueAt] = useState(() =>
    addDaysIso(initialSignedAt(), 30),
  );
  const [customPrepaymentDue, setCustomPrepaymentDue] = useState(false);
  const [customPostpaymentDue, setCustomPostpaymentDue] = useState(false);
  const [paymentComment, setPaymentComment] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const totalAmount = useMemo(
    () => services.reduce((sum, item) => sum + item.amount, 0),
    [services],
  );
  const prepaymentAmount = totalAmount * (prepaymentPercent / 100);
  const postpaymentAmount = totalAmount - prepaymentAmount;

  const reset = () => {
    const today = todayIso();
    setStep(1);
    setTemplateSource("MAMAGO");
    setUnp("");
    setClientName("");
    setContactName("");
    setPhoneE164("+375");
    setEgrStatus(null);
    setSignedAt(today);
    setContractNumber(contractNumberFromDate(today));
    setContractNumberIsAuto(true);
    setServices([]);
    setServiceName("");
    setServiceAmount("");
    setPrepaymentPercent(30);
    setCustomPrepayment("");
    setPrepaymentDueAt(today);
    setPostpaymentDueAt(addDaysIso(today, 30));
    setCustomPrepaymentDue(false);
    setCustomPostpaymentDue(false);
    setPaymentComment("");
    setError("");
    setSaving(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && !saving) reset();
  };

  const validateStep = (currentStep: number): boolean => {
    setError("");

    if (currentStep === 2) {
      if (!clientName.trim()) {
        setError("Укажите название клиента");
        return false;
      }

      if (unp && !/^\d{9}$/.test(unp)) {
        setError("УНП должен содержать 9 цифр");
        return false;
      }

      if (phoneE164 !== "+375" && !isValidE164Phone(phoneE164)) {
        setError("Введите телефон в формате +375 (XX) XXX-XX-XX");
        return false;
      }
    }

    if (currentStep === 3) {
      if (!signedAt) {
        setError("Укажите дату подписания");
        return false;
      }
      if (!contractNumber.trim()) {
        setError("Укажите номер договора");
        return false;
      }
    }

    if (currentStep === 4 && services.length === 0) {
      setError("Добавьте хотя бы одну услугу");
      return false;
    }

    if (currentStep === 5) {
      if (prepaymentPercent > 0 && !prepaymentDueAt) {
        setError("Укажите срок предоплаты");
        return false;
      }

      if (
        prepaymentDueAt &&
        prepaymentDueAt < signedAt
      ) {
        setError("Срок предоплаты не может быть раньше даты договора");
        return false;
      }

      if (prepaymentPercent < 100 && !postpaymentDueAt) {
        setError(
          prepaymentPercent > 0
            ? "Укажите срок постоплаты"
            : "Укажите срок оплаты",
        );
        return false;
      }

      const baseDate =
        prepaymentPercent > 0 ? prepaymentDueAt : signedAt;
      if (
        postpaymentDueAt &&
        baseDate &&
        postpaymentDueAt < baseDate
      ) {
        setError("Срок постоплаты не может быть раньше базовой даты оплаты");
        return false;
      }
    }

    return true;
  };

  const next = () => {
    if (!validateStep(step)) return;

    if (step === 3) {
      setPrepaymentDueAt(signedAt);
      setPostpaymentDueAt(addDaysIso(signedAt, 30));
      setCustomPrepaymentDue(false);
      setCustomPostpaymentDue(false);
    }

    setStep((value) => Math.min(5, value + 1));
  };

  const back = () => {
    setError("");
    setStep((value) => Math.max(1, value - 1));
  };

  const addService = () => {
    setError("");
    const name = serviceName.trim();
    const amount = parseAmount(serviceAmount);

    if (!name) {
      setError("Укажите название услуги");
      return;
    }
    if (amount == null) {
      setError("Укажите корректную стоимость услуги");
      return;
    }

    setServices((items) => [
      ...items,
      { id: crypto.randomUUID(), name, amount },
    ]);
    setServiceName("");
    setServiceAmount("");
  };

  const selectPrepaymentPercent = (value: number) => {
    setPrepaymentPercent(value);
    setCustomPrepayment("");
  };

  const applyCustomPrepayment = (raw: string) => {
    setCustomPrepayment(raw);
    const value = Number(raw);
    if (Number.isFinite(value)) {
      setPrepaymentPercent(Math.max(0, Math.min(100, Math.round(value))));
    }
  };

  const submit = async () => {
    if (!validateStep(5)) return;

    setError("");
    setSaving(true);

    try {
      const response = await fetch("/api/admin/commercial/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateSource,
          client: {
            unp,
            name: clientName.trim(),
            contactName: contactName.trim(),
            phoneE164: phoneE164 === "+375" ? "" : phoneE164,
          },
          contractNumber: contractNumber.trim(),
          signedAt,
          items: services.map((item) => ({
            name: item.name,
            amount: item.amount,
          })),
          prepaymentPercent,
          prepaymentDueAt: prepaymentPercent > 0 ? prepaymentDueAt : null,
          postpaymentDueAt:
            prepaymentPercent < 100 ? postpaymentDueAt : null,
          paymentComment: paymentComment.trim(),
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Не удалось создать договор");
      }

      setOpen(false);
      reset();
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось создать договор",
      );
    } finally {
      setSaving(false);
    }
  };

  const activePrepaymentPreset = PREPAYMENT_PRESETS.includes(
    prepaymentPercent as (typeof PREPAYMENT_PRESETS)[number],
  )
    ? prepaymentPercent
    : null;

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 w-full md:w-auto"
      >
        <Plus className="h-4 w-4" />
        Создать договор
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="flex max-h-[92dvh] w-[min(760px,calc(100%-1rem))] max-w-[760px] flex-col gap-0 overflow-hidden rounded-2xl p-0"
          showCloseButton
        >
          <div className="shrink-0 border-b bg-white px-5 pb-4 pt-5 sm:px-8 sm:pt-7">
            <DialogTitle className="pr-12 text-xl sm:text-2xl">
              {STEPS[step - 1]} · {step}/5
            </DialogTitle>
            <div
              className="mt-5 grid grid-cols-5 gap-2"
              aria-label={`Шаг ${step} из 5`}
            >
              {STEPS.map((label, index) => (
                <div
                  key={label}
                  className={cn(
                    "h-1.5 rounded-full",
                    index < step ? "bg-primary" : "bg-stone-200",
                  )}
                />
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
            {step === 1 ? (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Шаблон документов
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setTemplateSource("MAMAGO")}
                      className={cn(
                        "rounded-full border px-5 py-3 text-sm font-semibold transition-colors",
                        templateSource === "MAMAGO"
                          ? "border-foreground bg-foreground text-background"
                          : "border-stone-200 bg-white hover:bg-stone-50",
                      )}
                    >
                      Наш шаблон
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateSource("CLIENT")}
                      className={cn(
                        "rounded-full border px-5 py-3 text-sm font-semibold transition-colors",
                        templateSource === "CLIENT"
                          ? "border-foreground bg-foreground text-background"
                          : "border-stone-200 bg-white hover:bg-stone-50",
                      )}
                    >
                      Шаблон клиента
                    </button>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {templateSource === "MAMAGO"
                      ? "Используем шаблон mamaGo. Раздел — mamaGo.by."
                      : "Фиксируем шаблон клиента. Раздел — mamaGo.by."}
                  </p>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <UnpLookupField
                  id="contract-client-unp"
                  label="УНП"
                  value={unp}
                  helperText="Необязательно · проверим организацию по ЕГР"
                  onValueChange={(value) => {
                    setUnp(value);
                    if (value.length !== 9) setEgrStatus(null);
                  }}
                  onResolved={(result) => {
                    setEgrStatus(result);
                    if (result.legalName) setClientName(result.legalName);
                  }}
                  onReset={() => setEgrStatus(null)}
                />

                {egrStatus?.legalName ? (
                  <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium">Найдено в ЕГР</p>
                      <p className="text-xs opacity-80">
                        {egrStatus.source ?? "ЕГР"} · название заполнено автоматически
                      </p>
                    </div>
                  </div>
                ) : null}

                <div>
                  <label
                    htmlFor="contract-client-name"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Клиент <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="contract-client-name"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    placeholder="Название клиента"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contract-contact-name"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Контактное лицо
                    <span className="ml-2 font-normal text-muted-foreground">
                      необязательно
                    </span>
                  </label>
                  <Input
                    id="contract-contact-name"
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    placeholder="Иванов И.И."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Телефон
                    <span className="ml-2 font-normal text-muted-foreground">
                      необязательно
                    </span>
                  </label>
                  <PhoneInputByMask
                    valueE164={phoneE164}
                    onChangeE164={setPhoneE164}
                  />
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="contract-signed-at"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Дата подписания
                  </label>
                  <div className="relative">
                    <Input
                      id="contract-signed-at"
                      type="date"
                      value={signedAt}
                      onChange={(event) => {
                        const nextDate = event.target.value;
                        setSignedAt(nextDate);
                        if (contractNumberIsAuto && nextDate) {
                          setContractNumber(contractNumberFromDate(nextDate));
                        }
                      }}
                      className="pr-10"
                    />
                    <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="contract-number"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Номер договора
                  </label>
                  <p className="mb-2 text-xs text-muted-foreground">
                    По умолчанию из даты; можно изменить вручную
                  </p>
                  <Input
                    id="contract-number"
                    value={contractNumber}
                    onChange={(event) => {
                      setContractNumber(event.target.value);
                      setContractNumberIsAuto(false);
                    }}
                    placeholder="26/09/2026"
                  />
                </div>

                <div className="rounded-xl bg-stone-50 p-4 text-sm">
                  <p className="font-medium">Раздел</p>
                  <p className="mt-1 text-muted-foreground">mamaGo.by</p>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Своя услуга
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Добавьте услуги, которые входят в договор.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                  <Input
                    value={serviceName}
                    onChange={(event) => setServiceName(event.target.value)}
                    placeholder="Название услуги"
                  />
                  <Input
                    value={serviceAmount}
                    onChange={(event) => setServiceAmount(event.target.value)}
                    placeholder="Стоимость"
                    inputMode="decimal"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={addService}
                  className="w-full"
                >
                  <Plus className="h-4 w-4" />
                  Добавить
                </Button>

                {services.length ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Добавленные услуги
                    </p>
                    {services.map((service) => (
                      <div
                        key={service.id}
                        className="flex items-center justify-between gap-4 rounded-xl border bg-white p-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{service.name}</p>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {renderCurrencyText(formatPrice(service.amount), {
                              iconSize: "text",
                            })}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setServices((items) =>
                              items.filter((item) => item.id !== service.id),
                            )
                          }
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          aria-label={`Удалить услугу ${service.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}

                    <div className="flex justify-between border-t pt-3 text-sm">
                      <span className="text-muted-foreground">
                        Итого · позиций: {services.length}
                      </span>
                      <strong>
                        {renderCurrencyText(formatPrice(totalAmount), {
                          iconSize: "text",
                        })}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Добавьте хотя бы одну услугу
                  </div>
                )}
              </div>
            ) : null}

            {step === 5 ? (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Предоплата
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {PREPAYMENT_PRESETS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => selectPrepaymentPercent(value)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm font-semibold",
                          activePrepaymentPreset === value &&
                            customPrepayment === ""
                            ? "border-foreground bg-foreground text-background"
                            : "border-stone-200 bg-white",
                        )}
                      >
                        {value}%
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setCustomPrepayment(String(prepaymentPercent));
                      }}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm font-semibold",
                        customPrepayment !== ""
                          ? "border-foreground bg-foreground text-background"
                          : "border-stone-200 bg-white",
                      )}
                    >
                      Свой %
                    </button>
                  </div>
                  {customPrepayment !== "" ? (
                    <Input
                      className="mt-3 max-w-[180px]"
                      type="number"
                      min={0}
                      max={100}
                      value={customPrepayment}
                      onChange={(event) =>
                        applyCustomPrepayment(event.target.value)
                      }
                      placeholder="0–100"
                    />
                  ) : null}
                </div>

                {prepaymentPercent > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Срок предоплаты
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {PREPAYMENT_DUE_PRESETS.map((preset) => {
                        const date = addDaysIso(signedAt, preset.days);
                        const active =
                          !customPrepaymentDue && prepaymentDueAt === date;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setCustomPrepaymentDue(false);
                              setPrepaymentDueAt(date);
                              if (!customPostpaymentDue) {
                                setPostpaymentDueAt(addDaysIso(date, 30));
                              }
                            }}
                            className={cn(
                              "rounded-full border px-4 py-2 text-sm font-semibold",
                              active
                                ? "border-foreground bg-foreground text-background"
                                : "border-stone-200 bg-white",
                            )}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setCustomPrepaymentDue(true)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm font-semibold",
                          customPrepaymentDue
                            ? "border-foreground bg-foreground text-background"
                            : "border-stone-200 bg-white",
                        )}
                      >
                        Свой срок
                      </button>
                    </div>
                    {customPrepaymentDue ? (
                      <Input
                        className="mt-3 max-w-[220px]"
                        type="date"
                        value={prepaymentDueAt}
                        onChange={(event) => {
                          const date = event.target.value;
                          setPrepaymentDueAt(date);
                          if (date && !customPostpaymentDue) {
                            setPostpaymentDueAt(addDaysIso(date, 30));
                          }
                        }}
                      />
                    ) : null}
                  </div>
                ) : null}

                {prepaymentPercent < 100 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {prepaymentPercent > 0
                        ? "Срок постоплаты"
                        : "Срок оплаты"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {prepaymentPercent > 0
                        ? "Считается от даты предоплаты"
                        : "Считается от даты договора"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {POSTPAYMENT_DUE_PRESETS.map((preset) => {
                        const base =
                          prepaymentPercent > 0 ? prepaymentDueAt : signedAt;
                        const date = addDaysIso(base, preset.days);
                        const active =
                          !customPostpaymentDue && postpaymentDueAt === date;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setCustomPostpaymentDue(false);
                              setPostpaymentDueAt(date);
                            }}
                            className={cn(
                              "rounded-full border px-4 py-2 text-sm font-semibold",
                              active
                                ? "border-foreground bg-foreground text-background"
                                : "border-stone-200 bg-white",
                            )}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setCustomPostpaymentDue(true)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm font-semibold",
                          customPostpaymentDue
                            ? "border-foreground bg-foreground text-background"
                            : "border-stone-200 bg-white",
                        )}
                      >
                        Свой срок
                      </button>
                    </div>
                    {customPostpaymentDue ? (
                      <Input
                        className="mt-3 max-w-[220px]"
                        type="date"
                        value={postpaymentDueAt}
                        onChange={(event) =>
                          setPostpaymentDueAt(event.target.value)
                        }
                      />
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <label
                    htmlFor="contract-payment-comment"
                    className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Комментарий
                  </label>
                  <Input
                    id="contract-payment-comment"
                    value={paymentComment}
                    onChange={(event) => setPaymentComment(event.target.value)}
                    placeholder="Необязательно"
                  />
                </div>

                <div className="rounded-2xl bg-stone-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    График оплат
                  </p>
                  <div className="mt-3 space-y-2 text-sm">
                    {prepaymentPercent > 0 ? (
                      <div className="flex items-center justify-between gap-4">
                        <span>
                          Предоплата {prepaymentPercent}% ·{" "}
                          {formatShortDate(prepaymentDueAt)}
                        </span>
                        <strong>
                          {renderCurrencyText(formatPrice(prepaymentAmount), {
                            iconSize: "text",
                          })}
                        </strong>
                      </div>
                    ) : null}
                    {prepaymentPercent < 100 ? (
                      <div className="flex items-center justify-between gap-4">
                        <span>
                          {prepaymentPercent > 0 ? "Постоплата" : "Оплата"} ·{" "}
                          {formatShortDate(postpaymentDueAt)}
                        </span>
                        <strong>
                          {renderCurrencyText(formatPrice(postpaymentAmount), {
                            iconSize: "text",
                          })}
                        </strong>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {error ? (
              <div
                className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t bg-white p-4 sm:px-8 sm:py-5">
            <div className="grid grid-cols-2 gap-3">
              {step > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={back}
                  disabled={saving}
                  className="h-11"
                >
                  Назад
                </Button>
              ) : (
                <div />
              )}
              {step < 5 ? (
                <Button
                  type="button"
                  onClick={next}
                  className="h-11"
                >
                  Далее
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={submit}
                  disabled={saving}
                  className="h-11"
                >
                  {saving ? "Создаём…" : "Создать договор"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
