"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent, RefObject } from "react";
import type { BirthdayCatalogItem } from "../../lib/realCatalog";
import { catalogPriceLabel, catalogPriceSummary, partyBudgetWarning } from "../../lib/catalogSelection";
import { submitBirthdayParty, submittedPartyId, type PartyFlowState } from "../../lib/partySubmitFlow";
import { calendarDateKeyToIso, childAgeYearsOnDate } from "../../lib/partyDate";

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
  const [availability, setAvailability] = useState<"AVAILABLE" | "UNAVAILABLE" | "UNKNOWN" | "LOADING" | null>(null);
  const anchorOfferId = offers[0]?.id;
  const checkVenue = venueMode === "VENUE" || venueMode === "PACKAGE";
  const partySize = Number(children) + Number(adults);

  useEffect(() => {
    if (!checkVenue || !anchorOfferId || !date || !timeFrom || !timeTo ||
        timeFrom >= timeTo || !children || !adults || !Number.isFinite(partySize) ||
        partySize < 1 || partySize > 1000) {
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const query = new URLSearchParams({
          offerId: anchorOfferId, date, timeFrom, timeTo,
          childrenCount: children, adultsCount: adults,
        });
        const response = await fetch("/api/public/party-availability?" + query, {
          signal: controller.signal, cache: "no-store",
        });
        if (!response.ok) throw new Error("Preview unavailable");
        const result: { availability?: string } = await response.json();
        if (!controller.signal.aborted) {
          setLastPreviewKey([anchorOfferId, checkVenue, date, timeFrom, timeTo, children, adults].join("|"));
          setAvailability(
            result.availability === "AVAILABLE" || result.availability === "UNAVAILABLE"
              ? result.availability : "UNKNOWN"
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setLastPreviewKey([anchorOfferId, checkVenue, date, timeFrom, timeTo, children, adults].join("|"));
          setAvailability("UNKNOWN");
        }
      }
    }, 350);
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [anchorOfferId, checkVenue, date, timeFrom, timeTo, children, adults, partySize]);

  const previewKey = [anchorOfferId, checkVenue, date, timeFrom, timeTo, children, adults].join("|");
  const [lastPreviewKey, setLastPreviewKey] = useState("");
  const visibleAvailability = checkVenue && children && adults
    ? previewKey === lastPreviewKey ? availability : "LOADING"
    : null;


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
        {checkVenue && visibleAvailability && (
          <p role="status" className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
            {visibleAvailability === "LOADING" ? "Проверяем доступность выбранного времени…" :
             visibleAvailability === "AVAILABLE" ? "Предварительно свободно на выбранное время. Окончательно подтвердит исполнитель." :
             visibleAvailability === "UNAVAILABLE" ? "По текущему расписанию время занято. Можно изменить дату или отправить запрос исполнителю для уточнения." :
             "Нельзя автоматически подтвердить доступность. Исполнитель уточнит её после получения заявки."}
          </p>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy || authLoading || !offers.length} className="w-full rounded-xl bg-primary p-4 font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? "Отправляем…" : authenticated ? "Отправить заявку основному исполнителю" : "Войти и отправить заявку"}
        </button>
        <p className="text-center text-xs text-muted-foreground">Остальные исполнители получат заявки после согласования основного исполнителя.</p>
      </form>
    </section>
  );
}
