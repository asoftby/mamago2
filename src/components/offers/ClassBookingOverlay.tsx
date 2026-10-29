"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import type { PriceItem } from "@/lib/priceItems";

type ClassSlot = {
  startsAt: string;
  endsAt: string;
  remainingSeats: number | null;
};
type ClassGroup = { id: string; title: string; tariffs: Array<PriceItem & { periodDays?: number | null }>; slots: ClassSlot[] };
type SlotsResponse = { slots?: ClassSlot[]; groups?: ClassGroup[]; error?: string };
type BookingResponse = { bookingId?: string; status?: string; holdUntil?: string; error?: string };
type PublicBookingOption = {
  id: string; title: string; mode: "INCLUDED" | "OPTIONAL"; priceByn: string;
};
type OptionsResponse = { options?: PublicBookingOption[]; durationOptionsMinutes?: number[]; error?: string };
type PriceQuoteResponse = { quote?: {
  status: "FIXED" | "QUOTE_REQUIRED"; totalByn: string | null;
  extension?: { hours: number; amountByn: string; discountPercent: number } | null;
  options: Array<{ id: string; title: string; amountByn: string }>;
}; error?: string };
type PrefillResponse = {
  authenticated: boolean;
  user: { displayName: string | null; email: string | null; phone: string | null; phoneVerified: boolean } | null;
  children: Array<{ id: string; name: string | null; age: number | null }>;
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Minsk", weekday: "short", day: "numeric", month: "short",
});
const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Minsk", hour: "2-digit", minute: "2-digit", hour12: false,
});

export function ClassBookingOverlay({ open, onOpenChange, offerId, offerTitle, tariffs = [] }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: string;
  offerTitle: string;
  tariffs?: PriceItem[];
}) {
  const [slots, setSlots] = useState<ClassSlot[]>([]);
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedTariffId, setSelectedTariffId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [seats, setSeats] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingStatus, setBookingStatus] = useState("NEW");
  const [bookingHoldUntil, setBookingHoldUntil] = useState<string | null>(null);
  const [children, setChildren] = useState<PrefillResponse["children"]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [refresh, setRefresh] = useState(0);
  // Reuse the same token for network retries of an identical intent. Any
  // change in attendee details, date, tariff or extras produces a fresh token.
  const pendingIntentRef = useRef<{ signature: string; key: string } | null>(null);
  const [bookingOptions, setBookingOptions] = useState<PublicBookingOption[]>([]);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [durationOptions, setDurationOptions] = useState<number[]>([]);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [priceQuote, setPriceQuote] = useState<PriceQuoteResponse["quote"] | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const from = new Date();
    const to = new Date(from.getTime() + 30 * 86_400_000);
    const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString(), seats: String(seats) });
    if (durationMinutes !== null && durationOptions.length > 1) {
      params.set("durationMinutes", String(durationMinutes));
    }
    // Defer state updates into the asynchronous request, and cancel stale responses.
    void (async () => {
      try {
        const response = await fetch(`/api/public/offers/${encodeURIComponent(offerId)}/slots?${params}`, {
          signal: controller.signal,
        });
        const data = await response.json() as SlotsResponse;
        if (!response.ok) throw new Error(data.error || "Не удалось загрузить расписание");
        if (controller.signal.aborted) return;
        setSlots(data.slots ?? []);
        setGroups(data.groups ?? []);
        setSelected((previous) => (data.slots ?? []).some((slot) => slot.startsAt === previous) ? previous : null);
        setError(null);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить расписание");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [open, offerId, seats, durationMinutes, durationOptions.length, refresh]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetch("/api/public/bookings/camp-shift/prefill", {
      signal: controller.signal, credentials: "include", cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as PrefillResponse;
      if (controller.signal.aborted) return;
      setChildren(data.children ?? []);
      setSelectedChildId(data.children?.length === 1 ? data.children[0].id : "");
      if (data.user?.displayName) setName((previous) => previous || data.user!.displayName || "");
      if (data.user?.email) setEmail((previous) => previous || data.user!.email || "");
      if (data.user?.phoneVerified && data.user.phone) setPhone((previous) => previous || data.user!.phone || "");
    }).catch(() => undefined);
    return () => controller.abort();
  }, [open]);

  const group = groups.find((item) => item.id === selectedGroupId) ?? null;
  const shownTariffs = group ? group.tariffs : groups.length > 0 ? [] : tariffs;
  const visibleSlots = group ? group.slots : groups.length > 0 ? [] : slots;
  const chosen = useMemo(() => visibleSlots.find((slot) => slot.startsAt === selected) ?? null, [visibleSlots, selected]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setOptionsLoading(true);
    setOptionsError(null);
    void fetch(`/api/public/offers/${encodeURIComponent(offerId)}/price-quote`,
      { signal: controller.signal, cache: "no-store" }).then(async response => {
        const json = await response.json() as OptionsResponse;
        if (!response.ok) throw new Error(json.error ?? "Не удалось загрузить допуслуги");
        if (controller.signal.aborted) return;
        setBookingOptions(json.options ?? []);
        setSelectedOptionIds([]);
        const durations = json.durationOptionsMinutes ?? [];
        setDurationOptions(durations);
        setDurationMinutes(durations[0] ?? null);
      }).catch(error => {
        if (!controller.signal.aborted) {
          setBookingOptions([]);
          setOptionsError(error instanceof Error ? error.message : "Ошибка загрузки допуслуг");
        }
      }).finally(() => {
        if (!controller.signal.aborted) setOptionsLoading(false);
      });
    return () => controller.abort();
  }, [open, offerId]);

  // Price preview is never a booking. The reservation endpoint revalidates
  // the selected IDs and all amounts under its own transaction.
  useEffect(() => {
    if (!open || !chosen || (groups.length > 0 && !selectedGroupId) ||
        (shownTariffs.length > 0 && !selectedTariffId) || optionsLoading || optionsError) {
      setPriceQuote(null); setQuoteLoading(false); setQuoteError(null);
      return;
    }
    const controller = new AbortController();
    setQuoteLoading(true);
    setPriceQuote(null);
    setQuoteError(null);
    void fetch(`/api/public/offers/${encodeURIComponent(offerId)}/price-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startsAt: chosen.startsAt, endsAt: chosen.endsAt, seats,
        ...(selectedGroupId ? { classGroupId: selectedGroupId } : {}),
        ...(selectedTariffId ? { classTariffId: selectedTariffId } : {}),
        selectedOptionIds,
      }),
      signal: controller.signal,
    }).then(async response => {
      const json = await response.json() as PriceQuoteResponse;
      if (!response.ok || !json.quote) throw new Error(json.error ?? "Не удалось рассчитать стоимость");
      if (!controller.signal.aborted) setPriceQuote(json.quote);
    }).catch(error => {
      if (!controller.signal.aborted) setQuoteError(
        error instanceof Error ? error.message : "Не удалось рассчитать стоимость");
    }).finally(() => {
      if (!controller.signal.aborted) setQuoteLoading(false);
    });
    return () => controller.abort();
  }, [open, offerId, chosen?.startsAt, chosen?.endsAt, seats, selectedGroupId,
    selectedTariffId, selectedOptionIds, optionsLoading, optionsError, groups.length, shownTariffs.length]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen || submitting || quoteLoading || !priceQuote || optionsLoading || optionsError) return;
    setSubmitting(true);
    setError(null);
    try {
      const intent = {
          startsAt: chosen.startsAt, endsAt: chosen.endsAt,          ...(selectedGroupId ? { classGroupId: selectedGroupId } : {}),
          ...(selectedTariffId ? { classTariffId: selectedTariffId } : {}),
          selectedOptionIds,
          seats, customerName: name.trim(), customerPhone: phone.trim(),
          ...(email.trim() ? { customerEmail: email.trim() } : {}),
          ...(seats === 1 && selectedChildId ? { childId: selectedChildId } : {}),
      };
      const signature = JSON.stringify(intent);
      if (!pendingIntentRef.current || pendingIntentRef.current.signature !== signature) {
        pendingIntentRef.current = { signature, key: crypto.randomUUID() };
      }
      const response = await fetch(`/api/public/offers/${encodeURIComponent(offerId)}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...intent, idempotencyKey: pendingIntentRef.current.key }),
      });
      const result = await response.json() as BookingResponse;
      if (!response.ok) {
        if (response.status === 409) setRefresh((n) => n + 1);
        throw new Error(result.error || "Не получилось отправить заявку");
      }
      if (!result.bookingId) throw new Error("Не удалось получить номер заявки");
      pendingIntentRef.current = null;
      setBookingId(result.bookingId);
      setBookingStatus(result.status ?? "NEW");
      setBookingHoldUntil(result.holdUntil ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить заявку");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={(next) => {
        if (!next) { setBookingId(null); setBookingStatus("NEW"); setBookingHoldUntil(null); setSelected(null); setError(null); pendingIntentRef.current = null; }
        else setLoading(true);
        onOpenChange(next);
      }}
      a11yTitle="Запись на занятие"
      variant="framed"
      title="Запись на занятие"
      subtitle={offerTitle}
      heightMode="tall"
      dialogContentClassName="max-w-xl"
    >
      {bookingId ? (
        <div role="status" className="space-y-3 p-5">
          <h3 className="text-lg font-semibold">{bookingStatus === "CONFIRMED" ? "Запись подтверждена" :
            bookingStatus === "NEW" ? "Заявка отправлена" : "Состояние заявки обновлено"}</h3>
          <p>{bookingStatus === "NEW" && bookingHoldUntil && new Date(bookingHoldUntil) > new Date()
            ? "Место временно удерживается. Дождитесь подтверждения организатора."
            : bookingStatus === "NEW" ? "Время удержания истекло. Проверьте состояние бронирования."
            : bookingStatus === "CONFIRMED" ? "Организатор подтвердил вашу запись."
            : "Повторная отправка не создала новую заявку. Проверьте её текущий статус в личном кабинете."}</p>
          <p className="text-sm text-muted-foreground">Номер заявки: {bookingId}</p>
          <Button className="w-full" onClick={() => onOpenChange(false)}>Готово</Button>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="space-y-5 p-5">
          <div className="space-y-2">
            <label htmlFor="class-booking-seats" className="text-sm font-medium">Количество детей / мест</label>
            <Input id="class-booking-seats" type="number" min={1} max={20} value={seats}
              onChange={(event) => { setSeats(Math.max(1, Math.min(20, Number(event.target.value) || 1))); setLoading(true); }} />
          </div>
          {seats === 1 && children.length > 0 && (
            <div className="space-y-2">
              <label htmlFor="class-booking-child" className="text-sm font-medium">Для кого занятие</label>
              <select id="class-booking-child" className="w-full rounded-xl border bg-background p-3 text-sm"
                value={selectedChildId} onChange={(event) => setSelectedChildId(event.target.value)}>
                <option value="">Не выбирать из профиля</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>{child.name || "Ребёнок"}{child.age !== null ? ` · ${child.age} лет` : ""}</option>
                ))}
              </select>
            </div>
          )}
          {groups.length > 0 && (
            <div className="space-y-2">
              <label htmlFor="class-group" className="text-sm font-medium">Группа</label>
              <select id="class-group" required value={selectedGroupId}
                onChange={(event) => { setSelectedGroupId(event.target.value); setSelectedTariffId(""); setSelected(null); }}
                className="w-full rounded-xl border bg-background p-3 text-sm">
                <option value="">Выберите группу</option>
                {groups.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </div>
          )}
          {shownTariffs.length > 0 && (
            <div className="space-y-2">
              <label htmlFor="class-tariff" className="text-sm font-medium">Тариф</label>
              <select id="class-tariff" required value={selectedTariffId} onChange={(event) => setSelectedTariffId(event.target.value)} className="w-full rounded-xl border bg-background p-3 text-sm">
                <option value="">Выберите тариф</option>
                {shownTariffs.map((tariff) => <option key={tariff.id} value={tariff.id}>{tariff.label} — {tariff.price} {tariff.unit}</option>)}
              </select>
            </div>
          )}
          {durationOptions.length > 1 && (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="class-booking-duration">
                Продолжительность услуги
              </label>
              <select id="class-booking-duration" className="w-full rounded-xl border bg-background p-3 text-sm"
                value={durationMinutes ?? durationOptions[0]}
                onChange={event => {
                  setDurationMinutes(Number(event.target.value)); setSelected(null);
                  setLoading(true); setPriceQuote(null);
                }}>
                {durationOptions.map((minutes, index) => (
                  <option key={minutes} value={minutes}>
                    {minutes} мин{index > 0 ? ` · +${index} ч` : " · базовая"}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Продление оплачивается по тарифу организатора. Доступность времени пересчитывается.
              </p>
            </div>
          )}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Что входит и дополнительные услуги</legend>
            {optionsLoading && <p role="status" className="text-sm text-muted-foreground">Загружаем допуслуги…</p>}
            {optionsError && <p role="alert" className="text-sm text-destructive">{optionsError}</p>}
            {!optionsLoading && !optionsError && bookingOptions.length === 0 && (
              <p className="text-sm text-muted-foreground">Дополнительных услуг нет.</p>
            )}
            {bookingOptions.map(option => (
              <label key={option.id} className="flex items-center gap-3 rounded-xl border p-3">
                <input type="checkbox" checked={option.mode === "INCLUDED" ||
                  selectedOptionIds.includes(option.id)}
                  disabled={option.mode === "INCLUDED" || submitting || optionsLoading}
                  onChange={e => setSelectedOptionIds(old =>
                    e.target.checked ? [...old, option.id] : old.filter(id => id !== option.id))} />
                <span className="flex-1 text-sm">
                  {option.title}
                  {option.mode === "INCLUDED" &&
                    <span className="block text-xs text-muted-foreground">Уже включено</span>}
                </span>
                <span className="text-sm">
                  {option.mode === "INCLUDED" ? "Включено" : `+${option.priceByn} BYN`}
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Дата и время (Минск)</legend>
            {loading && <p role="status" className="text-sm text-muted-foreground">Загружаем расписание…</p>}
            {!loading && visibleSlots.length === 0 && !error && <p className="text-sm text-muted-foreground">Пока нет доступных занятий на ближайшие 30 дней.</p>}
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {visibleSlots.map((slot) => (
                <label key={slot.startsAt} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 has-[:checked]:border-primary">
                  <input type="radio" name="class-slot" value={slot.startsAt} checked={selected === slot.startsAt}
                    onChange={() => setSelected(slot.startsAt)} />
                  <span className="flex-1 text-sm">{dateFormatter.format(new Date(slot.startsAt))}, {timeFormatter.format(new Date(slot.startsAt))}</span>
                  {slot.remainingSeats !== null && <span className="text-xs text-muted-foreground">Мест: {slot.remainingSeats}</span>}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2">
            <label htmlFor="class-booking-name" className="text-sm font-medium">Ваше имя</label>
            <Input id="class-booking-name" autoComplete="name" required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} />
            <label htmlFor="class-booking-phone" className="text-sm font-medium">Телефон</label>
            <Input id="class-booking-phone" type="tel" autoComplete="tel" required minLength={7} maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} />
            <label htmlFor="class-booking-email" className="text-sm font-medium">Email (необязательно)</label>
            <Input id="class-booking-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          {chosen && (
            <div aria-live="polite" className="rounded-xl border border-border/70 p-3 text-sm">
              {quoteLoading ? "Пересчитываем стоимость…" :
                quoteError ? <span className="text-destructive">{quoteError}</span> :
                priceQuote?.status === "FIXED" && priceQuote.totalByn !== null
                  ? <div className="space-y-1">
                    <strong>Стоимость заявки: {priceQuote.totalByn} BYN</strong>
                    {priceQuote.extension && <p className="text-xs text-muted-foreground">
                      Продление {priceQuote.extension.hours} ч — {priceQuote.extension.amountByn} BYN
                      {priceQuote.extension.discountPercent > 0
                        ? ` (скидка ${priceQuote.extension.discountPercent}%)` : ""}
                    </p>}
                  </div>
                  : priceQuote ? <span>Стоимость уточняется у организатора</span>
                  : <span>Выберите тариф и время</span>}
              <p className="mt-1 text-xs text-muted-foreground">
                Сумма подтверждается сервером при отправке. Предварительная цена не резервирует место.
              </p>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={!chosen || loading || submitting || optionsLoading || Boolean(optionsError) || quoteLoading || !priceQuote || Boolean(quoteError) || (groups.length > 0 && !selectedGroupId) || (shownTariffs.length > 0 && !selectedTariffId)}>
            {submitting ? "Отправляем…" : "Отправить заявку"}
          </Button>
          <p className="text-xs text-muted-foreground">Заявка ещё не означает подтверждённую запись.</p>
        </form>
      )}
    </ResponsiveOverlay>
  );
}
