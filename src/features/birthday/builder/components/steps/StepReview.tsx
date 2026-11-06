"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import type { FormEvent, RefObject } from "react";
import type { BirthdayCatalogItem, PartyCategoryKey } from "../../lib/realCatalog";
import { catalogPriceLabel, catalogPriceSummary, partyBudgetWarning } from "../../lib/catalogSelection";
import { PartyRequestError, partyRequest, saveBirthdayComposition, submitBirthdayParty, submittedPartyId, type PartyFlowState, type PartyReviewDraft } from "../../lib/partySubmitFlow";
import { calendarDateKeyToIso, childAgeYearsOnDate } from "../../lib/partyDate";

type Props = {
  offers: BirthdayCatalogItem[];
  candidates: BirthdayCatalogItem[];
  selectedBaseId: string | null;
  onCompositionSaved: (saved: boolean) => void;
  ownerId: string | null;
  addonCategories?: PartyCategoryKey[];
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
  statedAgeYears?: number | null;
  authenticated: boolean;
  authLoading: boolean;
  requestLogin: () => void;
  flowStateRef: RefObject<PartyFlowState>;
  busy: boolean;
  onBusyChange: (value: boolean) => void;
  sent: boolean;
  onSent: () => void;
};

function forgetReviewDraft(scope: string | null) {
  if (!scope) return;
  try { sessionStorage.removeItem("mamago:party-review:" + scope); } catch { /* Storage is optional. */ }
}

export function StepReview({
  offers: initialOffers, candidates, ownerId, selectedBaseId, onCompositionSaved, addonCategories: initialCategories = [], citySlug, dateIso, quizDateKey, maxBudget, timeStart, timeEnd, venueMode, childName, childBirthDateIso, statedAgeYears,
  authenticated, authLoading, requestLogin, flowStateRef, busy, onBusyChange, sent, onSent,
}: Props) {
  const anchor = initialOffers[0];
  const scope = ownerId && selectedBaseId ? JSON.stringify([ownerId, citySlug, venueMode, selectedBaseId]) : null;
  const [review, setReview] = useState<PartyReviewDraft | null>(null);
  const [restoreState, setRestoreState] = useState<"loading" | "ready" | "error">("loading");
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState("");
  const [updatedAge, setUpdatedAge] = useState("");
  const savedIds = review?.items.filter(item => item.role === "STANDALONE").map(item => item.offerId);
  const offers = anchor && savedIds ? [anchor, ...savedIds.flatMap(id => {
    const offer = candidates.find(candidate => candidate.id === id) ?? initialOffers.find(candidate => candidate.id === id);
    return offer ? [offer] : [];
  })] : initialOffers;
  const hasUnavailableSelection = Boolean(savedIds && anchor && savedIds.length !== offers.length - 1);
  const addonCategories = review ? review.items.filter(item => item.role === "ADDON")
    .map(item => item.category as PartyCategoryKey) : initialCategories;
  const estimate = review?.estimate;
  const hasExactPrice = estimate?.lines.some(line => line.mode === "EXACT");
  const hasFromPrice = estimate?.lines.some(line => line.mode === "FROM");
  const priceByOffer = new Map(estimate?.lines.map(line => [line.offerId, line]));
  function priceLabel(offer: BirthdayCatalogItem) {
    const line = priceByOffer.get(offer.id);
    return line
      ? catalogPriceLabel({ priceFrom: line.amount, priceMode: line.mode, currency: "BYN" })
      : catalogPriceLabel(offer);
  }
  const total = estimate
    ? { minimumByn: estimate.exactByn + estimate.fromByn, hasUnknownPrices: estimate.unknownCount > 0 }
    : catalogPriceSummary(offers);
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
  const [suggestedSlots, setSuggestedSlots] = useState<Array<{ start: string; end: string }>>([]);
  const [slotMode, setSlotMode] = useState<"SCHEDULED" | "REQUEST_ONLY" | null>(null);
  const [slotsKey, setSlotsKey] = useState("");

  useEffect(() => {
    if (!scope || sent) return;
    let active = true;
    const key = "mamago:party-review:" + scope;
    async function restore() {
      const flow = flowStateRef.current;
      if (flow.scope !== scope) {
        Object.assign(flow, { scope, draft: null, pending: null, key: null, submitted: false });
      }
      flow.rememberDraft = (id) => {
        try { sessionStorage.setItem(key, id); } catch { /* Storage is optional. */ }
      };
      let id = flow.draft?.id;
      try { id ??= sessionStorage.getItem(key) ?? undefined; } catch { /* Storage is optional. */ }
      if (!id) {
        if (active) setRestoreState("ready");
        return;
      }
      try {
        const draft = await partyRequest<PartyReviewDraft>("/api/parent/parties/" + encodeURIComponent(id), "GET");
        if (!active) return;
        flow.draft = draft;
        if (draft.status !== "DRAFT" && draft.status !== "CANCELLED") {
          flow.submitted = true;
          forgetReviewDraft(scope);
          onSent();
        } else if (draft.status === "CANCELLED") {
          setRestoreState("error");
        } else {
          const hasAnchor = draft.items.some(item => item.role === "ANCHOR");
          setReview(hasAnchor ? draft : null);
          onCompositionSaved(hasAnchor);
          if (hasAnchor && draft.eventDate) setDate(draft.eventDate.slice(0, 10));
          setRestoreState("ready");
        }
      } catch {
        if (active) setRestoreState("error");
      }
    }
    void restore();
    return () => { active = false; };
  }, [scope, sent, flowStateRef, onSent, onCompositionSaved, restoreAttempt]);

  async function changeComposition(ids: string[]) {
    if (!anchor || busy || restoreState !== "ready") return;
    onBusyChange(true);
    setError(null);
    const selectedCategories = new Set(candidates.filter(offer => ids.includes(offer.id)).map(offer => offer.category));
    try {
      const updated = await saveBirthdayComposition(flowStateRef.current, {
        citySlug, venueMode, anchorOfferId: anchor.id, addonOfferIds: ids,
        addonCategories: addonCategories.filter(category => !selectedCategories.has(category)),
      }, partyRequest, date && (!needsAgeInput || enteredAge != null)
        ? { eventDate: date, childName: childName ?? review?.childName ?? null, childAge: recipientAge }
        : undefined);
      setReview(updated);
      onCompositionSaved(true);
      setCandidateId("");
      setReplacementId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить состав");
      setRestoreState("loading");
      setRestoreAttempt(value => value + 1);
    } finally {
      onBusyChange(false);
    }
  }

  const age = childAgeYearsOnDate(childBirthDateIso, date) ??
    (statedAgeYears != null && statedAgeYears <= 20 ? statedAgeYears : null);
  const savedAgeDate = review?.eventDate?.slice(0, 10);
  const needsAgeInput = age == null && review?.childAge != null && savedAgeDate !== date;
  const enteredAge = /^(0|[1-9]|1[0-9]|20)$/.test(updatedAge) ? Number(updatedAge) : null;
  const recipientAge = age ?? (savedAgeDate === date ? review?.childAge ?? null : enteredAge);

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

  useEffect(() => {
    const guests = Number(children) + Number(adults);
    const durationMinutes = /^([01]\\d|2[0-3]):[0-5]\\d$/.test(timeFrom) && /^([01]\\d|2[0-3]):[0-5]\\d$/.test(timeTo)
      ? (Number(timeTo.slice(0, 2)) * 60 + Number(timeTo.slice(3))) -
        (Number(timeFrom.slice(0, 2)) * 60 + Number(timeFrom.slice(3))) : 0;
    if (!checkVenue || !anchorOfferId || !date || !children || !adults ||
        !Number.isInteger(guests) || guests < 1 || guests > 1000 ||
        durationMinutes < 30 || durationMinutes > 720) {
      setSuggestedSlots([]); setSlotMode(null); setSlotsKey("");
      return;
    }
    const currentKey = [citySlug, anchorOfferId, date, durationMinutes, guests].join("|");
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ citySlug, offerId: anchorOfferId, day: date,
          durationMinutes: String(durationMinutes), guestCount: String(guests) });
        const response = await fetch("/api/public/birthday/availability?" + qs, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Slot preview unavailable");
        const result: { mode?: string; slots?: Array<{ start: string; end: string }> } = await response.json();
        if (!controller.signal.aborted) {
          setSuggestedSlots(Array.isArray(result.slots) ? result.slots.slice(0, 20) : []);
          setSlotMode(result.mode === "SCHEDULED" ? "SCHEDULED" : "REQUEST_ONLY");
          setSlotsKey(currentKey);
        }
      } catch {
        if (!controller.signal.aborted) { setSuggestedSlots([]); setSlotMode("REQUEST_ONLY"); setSlotsKey(currentKey); }
      }
    }, 350);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [citySlug, anchorOfferId, checkVenue, date, timeFrom, timeTo, children, adults]);

  const previewKey = [anchorOfferId, checkVenue, date, timeFrom, timeTo, children, adults].join("|");
  const [lastPreviewKey, setLastPreviewKey] = useState("");
  const visibleAvailability = checkVenue && children && adults
    ? previewKey === lastPreviewKey ? availability : "LOADING"
    : null;


  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !offers.length || hasUnavailableSelection || (scope && restoreState !== "ready")) return;
    if (!authenticated) { requestLogin(); return; }
    if (needsAgeInput && enteredAge == null) {
      setError("Укажите возраст ребёнка на новую дату");
      return;
    }
    if (timeTo <= timeFrom) { setError("Окончание должно быть позже начала"); return; }
    onBusyChange(true);
    setError(null);
    try {
      await submitBirthdayParty(flowStateRef.current, {
        citySlug, venueMode, eventDate: date, timeFrom, timeTo,
        childrenCount: Number(children), adultsCount: Number(adults),
        childName: childName ?? review?.childName ?? null, childAge: recipientAge,
        contactName: name, contactPhone: phone,
        anchorOfferId: offers[0].id, addonOfferIds: offers.slice(1).map((offer) => offer.id),
        addonCategories,
      });
      forgetReviewDraft(scope);
      onSent();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка отправки");
      if (cause instanceof PartyRequestError && cause.status === 409) {
        setRestoreState("loading");
        setRestoreAttempt(value => value + 1);
      }
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
    <section className="mx-auto w-full min-w-0 max-w-3xl space-y-7">
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
          <div key={offer.id} className={"flex flex-wrap items-center justify-between gap-3 p-4 " +
            (index > 0 ? "border-t border-stone-200" : "")}>
            <div className="min-w-0">
              <p className="text-sm text-stone-500">{offer.businessName}</p>
              <h3 className="font-semibold">{offer.title}</h3>
              {offer.productType === "PARTY_PACKAGE" && offer.includedCategories.length > 0 && (
                <p className="mt-1 text-xs text-stone-500">Включено несколько услуг в пакет</p>
              )}
            </div>
            <div className="min-w-0 break-words font-semibold">
              {priceLabel(offer)}
            </div>
            {index > 0 && scope && <div className="flex w-full flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={busy || restoreState !== "ready"}
                onClick={() => { setReplacementId(offer.id); setCandidateId(""); }}>Заменить</Button>
              <Button type="button" variant="ghost" disabled={busy || restoreState !== "ready"}
                onClick={() => void changeComposition((savedIds ?? offers.slice(1).map(item => item.id))
                  .filter((id): id is string => Boolean(id && id !== offer.id)))}>Удалить</Button>
            </div>}
          </div>
        ))}
      </div>
      {!authLoading && !authenticated && anchor && <Button type="button" variant="outline" className="h-auto min-h-9 max-w-full whitespace-normal" onClick={requestLogin}>
        Войти, чтобы редактировать и сохранить состав
      </Button>}
      {selectedBaseId && !anchor && <p role="status" className="text-sm text-muted-foreground">
        Основное предложение пока недоступно. Вернитесь к выбору, если оно не появится после загрузки каталога.
      </p>}
      {scope && restoreState === "loading" && <p role="status" className="text-sm text-muted-foreground">
        Восстанавливаем черновик…
      </p>}
      {scope && restoreState === "error" && <div role="alert">
        Не удалось восстановить черновик.
        <Button type="button" variant="outline" onClick={() => setRestoreAttempt(value => value + 1)}>Повторить</Button>
      </div>}
      {hasUnavailableSelection && <div role="alert">
        Некоторые сохранённые услуги больше не доступны.
        <Button type="button" variant="outline" disabled={busy || restoreState !== "ready"}
          onClick={() => void changeComposition(offers.slice(1).map(offer => offer.id))}>Убрать недоступные</Button>
      </div>}
      {scope && anchor && candidates.some(offer => !offers.some(selected => selected.id === offer.id)) && (
        <div className="grid min-w-0 grid-cols-1 gap-2">
          <label className="grid min-w-0 grid-cols-1 gap-2">
            {replacementId ? "Новая услуга взамен выбранной" : "Дополнительная услуга"}
            <select className="min-w-0 w-full rounded-md border border-border bg-background p-2 text-base"
              value={candidateId} onChange={event => setCandidateId(event.target.value)} disabled={busy || restoreState !== "ready"}>
              <option value="">Выберите услугу</option>
              {candidates.filter(offer => !offers.some(selected => selected.id === offer.id)).map(offer => (
                <option key={offer.id} value={offer.id}>{offer.title} · {catalogPriceLabel(offer)}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!candidateId || busy || hasUnavailableSelection || restoreState !== "ready"}
              onClick={() => void changeComposition(replacementId
                ? offers.slice(1).map(offer => offer.id === replacementId ? candidateId : offer.id)
                : [...offers.slice(1).map(offer => offer.id), candidateId])}>
              {replacementId ? "Сохранить замену" : "Добавить"}
            </Button>
            {replacementId && <Button type="button" variant="ghost"
              onClick={() => { setReplacementId(null); setCandidateId(""); }}>Отмена</Button>}
          </div>
        </div>
      )}
      {scope && anchor && !review && <Button type="button" variant="outline" className="h-auto min-h-9 max-w-full whitespace-normal" disabled={busy || restoreState !== "ready"}
        onClick={() => void changeComposition(offers.slice(1).map(offer => offer.id))}>Сохранить состав</Button>}
      {addonCategories.length > 0 && <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-stone-800">
        Дополнительно подберём исполнителей: {addonCategories.join(", ")}. Приглашения отправим после подтверждения основной услуги.
      </div>}
      <div className="rounded-xl bg-stone-100 p-5">
        <p className="text-sm text-stone-600">Предварительная сумма известных начальных цен</p>
        {estimate && hasExactPrice && <p className="mt-1 text-sm">
          Фиксированные цены: {estimate.exactByn.toLocaleString("ru-RU")} BYN
        </p>}
        {estimate && hasFromPrice && <p className="mt-1 text-sm">
          Начальные цены: от {estimate.fromByn.toLocaleString("ru-RU")} BYN
        </p>}
        <p className="mt-1 text-2xl font-bold">
          {hasExactPrice || hasFromPrice || total.minimumByn > 0
            ? (hasFromPrice || !estimate || total.hasUnknownPrices ? "От " : "") + total.minimumByn.toLocaleString("ru-RU") + " BYN"
            : "Стоимость уточняется"}
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
        <fieldset disabled={busy || Boolean(scope && restoreState !== "ready")} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">Дата праздника<input required type="date" value={date} onChange={e => { setDate(e.target.value); setUpdatedAge(""); }} className="block w-full rounded-lg border p-3" /></label>
          {needsAgeInput && <label className="text-sm">
            Возраст ребёнка на новую дату
            <input required type="number" min="0" max="20" value={updatedAge}
              onChange={event => setUpdatedAge(event.target.value)} className="block w-full rounded-lg border p-3 text-base" />
          </label>}
          <label className="text-sm">Количество детей<input required type="number" min="1" max="500" value={children} onChange={e => setChildren(e.target.value)} className="block w-full rounded-lg border p-3" /></label>
          <label className="text-sm">Начало<input required type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} className="block w-full rounded-lg border p-3" /></label>
          <label className="text-sm">Окончание<input required type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} className="block w-full rounded-lg border p-3" /></label>
          <label className="text-sm">Количество взрослых<input required type="number" min="0" max="500" value={adults} onChange={e => setAdults(e.target.value)} className="block w-full rounded-lg border p-3" /></label>
          <label className="text-sm">Ваше имя<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} className="block w-full rounded-lg border p-3" /></label>
          <label className="text-sm sm:col-span-2">Телефон<input required type="tel" maxLength={40} value={phone} onChange={e => setPhone(e.target.value)} className="block w-full rounded-lg border p-3" /></label>
        </fieldset>
        {checkVenue && slotsKey === [citySlug, anchorOfferId, date,
          (Number(timeTo.slice(0, 2)) * 60 + Number(timeTo.slice(3))) -
          (Number(timeFrom.slice(0, 2)) * 60 + Number(timeFrom.slice(3))),
          Number(children) + Number(adults)].join("|") && suggestedSlots.length > 0 && (
          <div className="rounded-xl border border-stone-200 p-4">
            <p className="mb-2 text-sm font-semibold">Возможное время праздника</p>
            <div className="flex flex-wrap gap-2">
              {suggestedSlots.map(slot => <button key={slot.start} type="button"
                onClick={() => { setTimeFrom(slot.start); setTimeTo(slot.end); }}
                className="rounded-full border border-stone-300 px-3 py-2 text-sm hover:border-primary"
                aria-label={`Выбрать время ${slot.start}–${slot.end}`}>
                {slot.start}–{slot.end}
              </button>)}
            </div>
            <p className="mt-2 text-xs text-stone-500">Это предварительная доступность, не бронь. Исполнитель подтвердит время.</p>
          </div>
        )}
        {checkVenue && slotMode === "REQUEST_ONLY" && slotsKey && (
          <p className="text-xs text-stone-500">Можно отправить запрос на выбранное время — исполнитель уточнит доступность.</p>
        )}
        {checkVenue && visibleAvailability && (
          <p role="status" className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
            {visibleAvailability === "LOADING" ? "Проверяем доступность выбранного времени…" :
             visibleAvailability === "AVAILABLE" ? "Предварительно свободно на выбранное время. Окончательно подтвердит исполнитель." :
             visibleAvailability === "UNAVAILABLE" ? "По текущему расписанию время занято. Можно изменить дату или отправить запрос исполнителю для уточнения." :
             "Нельзя автоматически подтвердить доступность. Исполнитель уточнит её после получения заявки."}
          </p>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy || authLoading || !offers.length || hasUnavailableSelection || Boolean(scope && restoreState !== "ready")} className="w-full rounded-xl bg-primary p-4 font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? "Отправляем…" : authenticated ? "Отправить заявку основному исполнителю" : "Войти и отправить заявку"}
        </button>
        <p className="text-center text-xs text-muted-foreground">Остальные исполнители получат заявки после согласования основного исполнителя.</p>
      </form>
    </section>
  );
}
