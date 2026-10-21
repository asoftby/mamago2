"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { BirthdayCatalogItem } from "../../lib/realCatalog";
import { catalogPriceLabel, catalogPriceSummary } from "../../lib/catalogSelection";
import { submitBirthdayParty, type PartyFlowState } from "../../lib/partySubmitFlow";

type Props = {
  offers: BirthdayCatalogItem[];
  citySlug: string;
  dateIso: string | null;
  quizDateKey: string | null;
  timeStart: string | null;
  timeEnd: string | null;
  venueMode: "VENUE" | "PACKAGE" | "HOME" | "OUTDOOR";
  childName: string | null;
  authenticated: boolean;
  authLoading: boolean;
  requestLogin: () => void;
};

// The range calendar persists YYYY-(zero-based month)-D keys, not ISO dates.
export function calendarDateKeyToIso(key: string | null): string | null {
  if (!key) return null;
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(key);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const monthIndex = Number(monthText);
  const day = Number(dayText);
  const valid = new Date(Date.UTC(year, monthIndex, day));
  if (valid.getUTCFullYear() !== year || valid.getUTCMonth() !== monthIndex ||
      valid.getUTCDate() !== day) return null;
  return yearText + "-" + String(monthIndex + 1).padStart(2, "0") + "-" +
    String(day).padStart(2, "0");
}

export function StepReview({ offers, citySlug, dateIso, quizDateKey, timeStart, timeEnd, venueMode, childName, authenticated, authLoading, requestLogin }: Props) {
  const total = catalogPriceSummary(offers);
  const [date, setDate] = useState(dateIso ?? calendarDateKeyToIso(quizDateKey) ?? "");
  const [timeFrom, setTimeFrom] = useState(timeStart ?? "15:00");
  const [timeTo, setTimeTo] = useState(timeEnd ?? "18:00");
  const [children, setChildren] = useState("");
  const [adults, setAdults] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const flowRef = useRef<PartyFlowState>({
    draft: null, pending: null, key: null, submitted: false,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !offers.length) return;
    if (!authenticated) { requestLogin(); return; }
    if (timeTo <= timeFrom) { setError("Окончание должно быть позже начала"); return; }
    setBusy(true);
    setError(null);
    try {
      await submitBirthdayParty(flowRef.current, {
        citySlug, venueMode, eventDate: date, timeFrom, timeTo,
        childrenCount: Number(children), adultsCount: Number(adults),
        childName: childName || null, contactName: name, contactPhone: phone,
        anchorOfferId: offers[0].id, addonOfferIds: offers.slice(1).map((offer) => offer.id),
      });
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка отправки");
    } finally {
      setBusy(false);
    }
  }

  if (sent) return <section role="status" className="mx-auto max-w-3xl space-y-4 py-10">
    <h2 className="text-2xl font-semibold">Заявка основному исполнителю отправлена</h2>
    <p>Остальные выбранные услуги сохранены в празднике. Заявки по ним пока не отправлены.</p>
  </section>;

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
          <p className="mt-2 text-sm text-stone-600">Некоторые услуги рассчитываются индивидуально и в эту сумму не включены.</p>
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
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy || authLoading || !offers.length} className="w-full rounded-xl bg-primary p-4 font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? "Отправляем…" : authenticated ? "Отправить заявку основному исполнителю" : "Войти и отправить заявку"}
        </button>
        <p className="text-center text-xs text-muted-foreground">Остальные исполнители получат заявки после согласования основного исполнителя.</p>
      </form>
    </section>
  );
}
