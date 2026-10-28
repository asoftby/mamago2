"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent, RefObject } from "react";
import type { BirthdayCatalogItem } from "../../lib/realCatalog";
import { catalogPriceLabel, catalogPriceSummary, partyBudgetWarning } from "../../lib/catalogSelection";
import { submitBirthdayParty, submittedPartyId, type PartyFlowState } from "../../lib/partySubmitFlow";
import { calendarDateKeyToIso, childAgeYearsOnDate } from "../../lib/partyDate";

type Slot = { start: string; end: string };
type AvailabilityState =
  | { status: "idle" | "loading" }
  | { status: "ready"; mode: "REQUEST_ONLY" | "SCHEDULED"; slots: Slot[] }
  | { status: "error" };

function durationOf(from: string, to: string): number {
  const asMinutes = (time: string): number | null => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };
  const start = asMinutes(from);
  const end = asMinutes(to);
  return start == null || end == null ? 0 : end - start;
}

type Props = {
  offers: BirthdayCatalogItem[];
  citySlug: string;
  dateIso: string | null;
  quizDateKey: string | null;
  /** Upper bound of the chosen budget group in BYN; informational only. */
  maxBudget: number | null;
  timeStart: string | null;
  timeEnd: string | null;
  venueMode: "VENUE" | "PACKAGE" | "HOME" | "OUTDOOR";
  childName: string | null;
  childBirthDateIso: string | null;
  authenticated: boolean;
  authLoading: boolean;
  requestLogin: () => void;
  flowStateRef: RefObject<PartyFlowState>;
  busy: boolean;
  onBusyChange: (value: boolean) => void;
  sent: boolean;
  onSent: () => void;
};

export function StepReview({
  offers, citySlug, dateIso, quizDateKey, maxBudget, timeStart, timeEnd, venueMode, childName, childBirthDateIso,
  authenticated, authLoading, requestLogin, flowStateRef, busy, onBusyChange, sent, onSent,
}: Props) {
  const total = catalogPriceSummary(offers);
  const budgetWarning = partyBudgetWarning(total, maxBudget);
  const [date, setDate] = useState(dateIso ?? calendarDateKeyToIso(quizDateKey) ?? "");
  const [timeFrom, setTimeFrom] = useState(timeStart ?? "15:00");
  const [timeTo, setTimeTo] = useState(timeEnd ?? "18:00");
  const [children, setChildren] = useState("");
  const [adults, setAdults] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityState>({ status: "idle" });
  const selectedOfferId = offers[0]?.id;
  const durationMinutes = durationOf(timeFrom, timeTo);
  const guestCount = children !== "" && adults !== "" ? Number(children) + Number(adults) : 0;

  useEffect(() => {
    if (!selectedOfferId || !date || !Number.isInteger(guestCount) || guestCount < 1 ||
        guestCount > 1000 || durationMinutes < 30 || durationMinutes > 720) {
      setAvailability({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    const query = new URLSearchParams({
      city: citySlug, offerId: selectedOfferId, date,
      durationMinutes: String(durationMinutes), guestCount: String(guestCount),
    });
    setAvailability({ status: "loading" });
    fetch("/api/public/birthday/availability?" + query.toString(), {
      cache: "no-store", signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error("Availability failed");
        return response.json() as Promise<{ mode: "REQUEST_ONLY" | "SCHEDULED"; slots: Slot[] }>;
      })
      .then(data => { if (!controller.signal.aborted) setAvailability({ status: "ready", ...data }); })
      .catch(() => { if (!controller.signal.aborted) setAvailability({ status: "error" }); });
    return () => controller.abort();
  }, [selectedOfferId, citySlug, date, durationMinutes, guestCount]);


  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !offers.length) return;
    if (!authenticated) { requestLogin(); return; }
    if (timeTo <= timeFrom) { setError("Окончание должно быть позже начала"); return; }
    onBusyChange(true);
    setError(null);
    try {
      await submitBirthdayParty(flowStateRef.current, {
        citySlug, venueMode, eventDate: date, timeFrom, timeTo,
        childrenCount: Number(children), adultsCount: Number(adults),
        childName: childName || null, childAge: childAgeYearsOnDate(childBirthDateIso, date),
        contactName: name, contactPhone: phone,
        anchorOfferId: offers[0].id, addonOfferIds: offers.slice(1).map((offer) => offer.id),
      });
      onSent();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка отправки");
    } finally {
      onBusyChange(false);
    }
  }

  if (sent) {
    // Read from the parent-owned ref so a remounted review step still links the same order.
    const partyId = submittedPartyId(flowStateRef.current);
    return <section role="status" className="mx-auto max-w-3xl space-y-4 py-10">
      <h2 className="text-2xl font-semibold">Заявка основному исполнителю отправлена</h2>
      <p>Остальные выбранные услуги сохранены в празднике. Заявки по ним пока не отправлены.</p>
      <Link href={partyId ? "/me/birthdays/" + encodeURIComponent(partyId) : "/me/birthdays"}
        className="inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">
        {partyId ? "Открыть праздник" : "Мои праздники"}
      </Link>
    </section>;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-7">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-primary">Шаг 5 · предварительный план</p>
        <h2 className="text-3xl font-semibold sm:text-5xl">Вы выбрали услуги</h2>
        <p className="text-stone-600">
          Сначала отправим заявку основному исполнителю. Остальные услуги сохранятся в празднике;
          дата и стоимость будут подтверждены исполнителем.
        </p>
      </header>
      <div className="overflow-hidden rounded-2xl border border-stone-200">
        {offers.map((offer, index) => (
          <div key={offer.id} className={"flex items-center justify-between gap-4 p-5 " +
            (index > 0 ? "border-t border-stone-200" : "")}>
            <div className="min-w-0">
              <p className="text-sm text-stone-500">{offer.businessName}</p>
              <h3 className="font-semibold">{offer.title}</h3>
              {offer.productType === "PARTY_PACKAGE" && offer.includedCategories.length > 0 && (
                <p className="mt-1 text-xs text-stone-500">Включено несколько услуг в пакет</p>
              )}
            </div>
            <div className="shrink-0 font-semibold">
              {catalogPriceLabel(offer)}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-stone-100 p-5">
        <p className="text-sm text-stone-600">Предварительная сумма известных начальных цен</p>
        <p className="mt-1 text-2xl font-bold">
          {total.minimumByn > 0 ? "От " + total.minimumByn.toLocaleString("ru-RU") + " BYN" : "Стоимость уточняется"}
        </p>
        {total.hasUnknownPrices && (
          <p className="mt-2 text-sm text-stone-600">Некоторые услуги рассчитываются индивидуально и в эту сумму не включены, поэтому окончательная сумма пока неизвестна.</p>
        )}
        {budgetWarning && (
          <p role="note" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{budgetWarning}</p>
        )}
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <h3 className="font-semibold">Данные для заявки</h3>
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Дата праздника<input required type="date" value={date} onChange={e => setDate(e.target.value)} className="block w-full rounded-lg border p-3" /></label>
          <label className="text-sm">Количество детей<input required type="number" min="1" max="500" value={children} onChange={e => setChildren(e.target.value)} className="block w-full rounded-lg border p-3" /></label>
          <label className="text-sm">Начало<input required type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} className="block w-full rounded-lg border p-3" /></label>
          <label className="text-sm">Окончание<input required type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} className="block w-full rounded-lg border p-3" /></label>
          <label className="text-sm">Количество взрослых<input required type="number" min="0" max="500" value={adults} onChange={e => setAdults(e.target.value)} className="block w-full rounded-lg border p-3" /></label>
          <label className="text-sm">Ваше имя<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} className="block w-full rounded-lg border p-3" /></label>
          <label className="text-sm sm:col-span-2">Телефон<input required type="tel" maxLength={40} value={phone} onChange={e => setPhone(e.target.value)} className="block w-full rounded-lg border p-3" /></label>
        </fieldset>
        <section aria-label="Предварительная доступность" className="rounded-xl border border-stone-200 bg-white p-4">
          <h4 className="font-semibold text-stone-900">Свободное время</h4>
          <p className="mt-1 text-xs text-stone-600">
            Подсказка по расписанию основного исполнителя на выбранную дату.
            Время не резервируется до подтверждения заказа.
          </p>
          {availability.status === "idle" ? (
            <p className="mt-3 text-sm text-stone-600">Укажите дату, количество гостей и продолжительность праздника.</p>
          ) : availability.status === "loading" ? (
            <p role="status" className="mt-3 text-sm text-stone-600">Проверяем свободные интервалы…</p>
          ) : availability.status === "error" ? (
            <p role="status" className="mt-3 text-sm text-stone-600">
              Сейчас не удалось проверить расписание. Можно отправить заявку, время уточнит исполнитель.
            </p>
          ) : availability.mode === "REQUEST_ONLY" ? (
            <p className="mt-3 text-sm text-stone-600">
              У исполнителя пока нет настроенного календаря бронирования. Доступность уточняется по заявке.
            </p>
          ) : availability.slots.length === 0 ? (
            <p className="mt-3 text-sm text-stone-600">
              На эту дату свободных интервалов указанной длительности не найдено. Попробуйте другую дату или время;
              заявку также можно отправить для уточнения.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-stone-600">Выберите подходящий интервал:</p>
              <div role="group" aria-label="Предварительно свободные интервалы" className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                {availability.slots.map(slot => (
                  <button
                    key={slot.start + "-" + slot.end}
                    type="button"
                    aria-pressed={timeFrom === slot.start && timeTo === slot.end}
                    className={"rounded-full border px-3 py-2 text-sm font-medium transition " +
                      (timeFrom === slot.start && timeTo === slot.end
                        ? "border-stone-950 bg-stone-950 text-white"
                        : "border-stone-200 bg-stone-50 text-stone-900 hover:border-stone-500")}
                    onClick={() => { setTimeFrom(slot.start); setTimeTo(slot.end); }}
                  >
                    {slot.start}–{slot.end}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy || authLoading || !offers.length} className="w-full rounded-xl bg-primary p-4 font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? "Отправляем…" : authenticated ? "Отправить заявку основному исполнителю" : "Войти и отправить заявку"}
        </button>
        <p className="text-center text-xs text-muted-foreground">Остальные исполнители получат заявки после согласования основного исполнителя.</p>
      </form>
    </section>
  );
}
