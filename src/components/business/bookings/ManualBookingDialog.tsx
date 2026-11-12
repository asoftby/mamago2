"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatHHMM } from "@/lib/formatters/date";
import { buildManualPlaceReservation } from "./manualPlaceReservation";
import { Textarea } from "@/components/ui/textarea";

type Publication = { id: string; title: string; offerBooking?: { id: string } | null };
type OfferSlot = { startsAt: string; endsAt: string; unitIds: string[] };
type Tariff = { id: string; label: string };
type OfferDetails = { id: string; timezone: string; tariffs: Tariff[]; units: Record<string, string>; groups: { id: string; title: string; tariffs: Tariff[] }[] };
type Type = "EVENT" | "PLACE" | "OFFER";
type PlaceUnit = {
  id: string;
  name: string;
  timezone: string;
  minDurationMinutes: number | null;
  prepMinutes: number;
  cleanupMinutes: number;
  stepMinutes: number;
};
const durationSteps = [15, ...Array.from({ length: 16 }, (_, index) => (index + 1) * 30)];
function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} ч${rest ? ` ${rest} мин` : ""}` : `${rest} мин`;
}
function dateTimeLabel(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("ru-BY", {
    timeZone: timezone, day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date);
}
type Availability = {
  mode: "REQUEST_ONLY" | "USE_PUBLICATION_SLOTS" | "USE_PUBLICATION_DATES";
  dates: string[];
  slots: { id: string; date: string; time: string }[];
};

const selectClass = "min-h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring";
const endpoint = "/api/business/bookings/manual";

export function ManualBookingDialog({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (booking: { bookingId: string; status: string; date?: string }) => void;
}) {
  const [type, setType] = useState<Type>("EVENT");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [list, setList] = useState<{ key: string; items: Publication[] }>();
  const [publicationId, setPublicationId] = useState("");
  const [availability, setAvailability] = useState<{ id: string; value: Availability }>();
  const [groupId, setGroupId] = useState("");
  const [offerDate, setOfferDate] = useState("");
  const [offerSlots, setOfferSlots] = useState<{ key: string; choices: OfferSlot[] }>();
  const [offerChoiceIndex, setOfferChoiceIndex] = useState("");
  const [offerDetails, setOfferDetails] = useState<OfferDetails>();
  const [placeResourceList, setPlaceResourceList] = useState<{ placeId: string; units: PlaceUnit[] }>();
  const [placeResourceError, setPlaceResourceError] = useState("");
  const [reservePlaceResource, setReservePlaceResource] = useState(false);
  const [placeResourceId, setPlaceResourceId] = useState("");
  const [placeDate, setPlaceDate] = useState("");
  const [placeTime, setPlaceTime] = useState("");
  const [placeDuration, setPlaceDuration] = useState(60);
  const [bookingStatus, setBookingStatus] = useState<"NEW" | "CONFIRMED">("CONFIRMED");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<{ key: string; intent: string } | null>(null);
  const inFlight = useRef(false);
  const listKey = type + ":" + search;
  const items = list?.key === listKey ? list.items : undefined;
  const options = availability?.id === publicationId ? availability.value : undefined;
  const scheduledOffer = type === "OFFER" && Boolean(items?.find(({ id }) => id === publicationId)?.offerBooking);
  const offerKey = publicationId + ":" + groupId + ":" + offerDate;
  const choices = offerSlots?.key === offerKey ? offerSlots.choices : undefined;
  const choice = offerChoiceIndex && choices ? choices[Number(offerChoiceIndex)] : undefined;
  const details = offerDetails?.id === publicationId ? offerDetails : undefined;
  const unitIds = choice?.unitIds ?? [];
  const hasGroups = Boolean(details?.groups.length);
  const selectedGroup = details?.groups.find((group) => group.id === groupId);
  const tariffs = hasGroups ? selectedGroup?.tariffs : details?.tariffs;
  const placeUnits = placeResourceList?.placeId === publicationId ? placeResourceList.units : undefined;
  const selectedPlaceUnit = placeUnits?.find((unit) => unit.id === placeResourceId) ??
    (placeUnits?.length === 1 ? placeUnits[0] : undefined);
  const durations = selectedPlaceUnit ? [
    ...durationSteps.filter((minutes) => minutes >= (selectedPlaceUnit.minDurationMinutes ?? 15)),
    ...(selectedPlaceUnit.minDurationMinutes !== null &&
      selectedPlaceUnit.minDurationMinutes > 480 ? [selectedPlaceUnit.minDurationMinutes] : []),
  ] : [];
  const selectedDuration = durations.includes(placeDuration) ? placeDuration : (durations[0] ?? 0);
  const placeReservation = reservePlaceResource && selectedPlaceUnit
    ? buildManualPlaceReservation({
        bookingUnitId: selectedPlaceUnit.id, date: placeDate, time: placeTime,
        timezone: selectedPlaceUnit.timezone, durationMinutes: selectedDuration,
        prepMinutes: selectedPlaceUnit.prepMinutes, cleanupMinutes: selectedPlaceUnit.cleanupMinutes,
      }) : null;
  const placeStart = placeReservation ? new Date(placeReservation.resourceReservation.startsAt) : null;
  const placeEnd = placeReservation ? new Date(placeReservation.resourceReservation.endsAt) : null;
  const placeResourceReady = !reservePlaceResource || (
    type === "PLACE" && bookingStatus === "CONFIRMED" &&
    Boolean(placeReservation && placeStart && placeStart > new Date())
  );
  const ready = placeResourceReady && (!scheduledOffer || Boolean(choice)) && Boolean(publicationId &&
    (type !== "EVENT" || (options &&
      (options.mode === "REQUEST_ONLY" || options.slots.length || options.dates.length))));

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ type, q: search });
    fetch(endpoint + "?" + params, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const { items } = await response.json() as { items: Publication[] };
        setList({ key: listKey, items });
      })
      .catch(() => { if (!controller.signal.aborted) setError("Не удалось загрузить публикации"); });
    return () => controller.abort();
  }, [type, search, listKey]);

  useEffect(() => {
    if (type !== "EVENT" || !publicationId) return;
    const controller = new AbortController();
    fetch(endpoint + "?" + new URLSearchParams({ type, eventId: publicationId }), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setAvailability({ id: publicationId, value: await response.json() as Availability });
      })
      .catch(() => { if (!controller.signal.aborted) setError("Не удалось загрузить расписание"); });
    return () => controller.abort();
  }, [type, publicationId]);

  useEffect(() => {
    if (!scheduledOffer || !offerDate || !details || (hasGroups && !groupId)) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ type: "OFFER", offerId: publicationId, date: offerDate, groupId });
    fetch(endpoint + "?" + params, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const { slots } = await response.json() as { slots: OfferSlot[] };
        setOfferSlots({ key: offerKey, choices: slots });
      })
      .catch(() => { if (!controller.signal.aborted) setError("Не удалось загрузить слоты предложения"); });
    return () => controller.abort();
  }, [scheduledOffer, publicationId, offerDate, offerKey, details, hasGroups, groupId]);

  useEffect(() => {
    if (type !== "PLACE" || !publicationId || !reservePlaceResource) return;
    const controller = new AbortController();
    setPlaceResourceError("");
    fetch(endpoint + "?" + new URLSearchParams({ type: "PLACE", placeId: publicationId }), {
      signal: controller.signal,
      cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) throw new Error("Не удалось загрузить ресурсы");
      return response.json() as Promise<{ units: PlaceUnit[] }>;
    }).then(({ units }) => {
      if (!Array.isArray(units)) throw new Error("Резервирование ресурсов недоступно");
      if (!controller.signal.aborted) setPlaceResourceList({ placeId: publicationId, units });
    }).catch(() => {
      if (!controller.signal.aborted) setPlaceResourceError("Не удалось загрузить ресурсы. Повторите выбор места.");
    });
    return () => controller.abort();
  }, [type, publicationId, reservePlaceResource]);

  const needsResourcePicker = unitIds.length > 1;
  useEffect(() => {
    if (!scheduledOffer || !publicationId) return;
    const controller = new AbortController();
    fetch(endpoint + "?" + new URLSearchParams({ type: "OFFER", offerId: publicationId }), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const metadata = await response.json() as Omit<OfferDetails, "id">;
        setOfferDetails({ ...metadata, id: publicationId });
      })
      .catch(() => { if (!controller.signal.aborted) setError("Не удалось загрузить параметры предложения"); });
    return () => controller.abort();
  }, [scheduledOffer, publicationId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || inFlight.current) return;
    const data = new FormData(event.currentTarget);
    const slot = options?.slots.find(({ id }) => id === data.get("slot"));
    const requestedDate = (scheduledOffer ? offerDate : slot?.date) || String(data.get("date") ?? "") || undefined;
    if (reservePlaceResource && (!selectedPlaceUnit || !placeReservation ||
        bookingStatus !== "CONFIRMED")) {
      setError("Выберите ресурс, дату, время и продолжительность записи.");
      return;
    }
    const intent = {
      publicationType: type, publicationId,
      selectedSessionId: slot?.id,
      resourceReservation: reservePlaceResource ? placeReservation?.resourceReservation : undefined,
      offerSlot: choice ? {
        startsAt: choice.startsAt, endsAt: choice.endsAt, groupId: groupId || undefined,
        tariffId: String(data.get("tariff") ?? "") || undefined,
        unitId: choice.unitIds.length === 1 ? choice.unitIds[0] : String(data.get("unit") ?? "") || undefined,
      } : undefined,
      requestedDate,
      requestedTime: slot?.time || String(data.get("time") ?? "") || undefined,
      customerName: String(data.get("name")),
      customerPhone: String(data.get("phone")),
      customerEmail: String(data.get("email") ?? "").trim() || undefined,
      customerComment: String(data.get("comment") ?? "").trim() || undefined,
      adultsCount: Number(data.get("adults")),
      childrenCount: Number(data.get("children")),
      status: String(data.get("status")),
    };
    const serialized = JSON.stringify(intent);
    if (request.current?.intent !== serialized) request.current = { key: crypto.randomUUID(), intent: serialized };
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...intent, requestKey: request.current.key }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Не удалось сохранить запись");
      onCreated({ bookingId: result.bookingId, status: result.status, date: requestedDate });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось сохранить запись");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !inFlight.current) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-4 sm:max-w-xl sm:p-6" dismissible={!busy} showCloseButton={!busy}>
        <DialogHeader className="pr-10 text-left">
          <DialogTitle>Новая запись</DialogTitle>
          <DialogDescription>
            Выберите публикацию и укажите клиента. Запись с датой будет видна и в календаре.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="grid gap-4">
            <h3 className="text-sm font-semibold text-stone-950">1. Что бронируем</h3>
            <label className="grid gap-1 text-sm">Раздел
              <select className={selectClass} value={type} onChange={(e) => {
                setType(e.target.value as Type); setPublicationId(""); setSearch(""); setQuery(""); setError("");
                setReservePlaceResource(false); setPlaceResourceId(""); setPlaceDate(""); setPlaceTime("");
              }}>
                <option value="EVENT">Событие</option>
                <option value="PLACE">Место</option>
                <option value="OFFER">Занятие или услуга</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">Выберите публикацию
              <select className={selectClass} required value={publicationId} onChange={(e) => {
                setPublicationId(e.target.value); setOfferDate(""); setGroupId(""); setOfferChoiceIndex(""); setError("");
                setReservePlaceResource(false); setPlaceResourceId(""); setPlaceDate(""); setPlaceTime("");
              }}>
                <option value="">{!items ? "Загружаем…" : items.length ? "Выберите публикацию" : "Публикаций нет"}</option>
                {items?.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
              </select>
            </label>
            <details className="rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-3">
              <summary className="cursor-pointer text-sm font-medium text-stone-700">
                Не нашли нужное в списке? Поиск по названию
              </summary>
              <div className="mt-3">
                <div className="flex min-w-0 items-end gap-2">
                  <label className="grid min-w-0 flex-1 gap-1 text-sm">Название
                    <Input className="min-h-11 text-base" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100} />
                  </label>
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => {
                  if (query.trim() !== search) { setSearch(query.trim()); setPublicationId(""); setError(""); }
                  }}>Найти</Button>
                </div>
              </div>
            </details>
            {type === "EVENT" && publicationId && !options && !error ? <p role="status">Загружаем расписание…</p> : null}
            {options?.mode === "USE_PUBLICATION_SLOTS" ? (
              <label className="grid gap-1 text-sm" key={publicationId}>Дата и время
                <select className={selectClass} name="slot" required defaultValue="">
                  <option value="">{options.slots.length ? "Выберите слот" : "Доступных слотов нет"}</option>
                  {options.slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.date} · {slot.time}</option>)}
                </select>
              </label>
            ) : null}
            {options?.mode === "USE_PUBLICATION_DATES" ? (
              <label className="grid gap-1 text-sm" key={publicationId}>Дата
                <select className={selectClass} name="date" required defaultValue="">
                  <option value="">{options.dates.length ? "Выберите дату" : "Доступных дат нет"}</option>
                  {options.dates.map((date) => <option key={date}>{date}</option>)}
                </select>
              </label>
            ) : null}
            {scheduledOffer && !details && !error ? <p role="status">Загружаем параметры предложения…</p> : null}
            {scheduledOffer && details ? (
              <>
                {hasGroups ? <label className="grid gap-1 text-sm">Группа
                  <select className={selectClass} required value={groupId} onChange={(event) => {
                    setGroupId(event.target.value); setOfferChoiceIndex(""); setError("");
                  }}>
                    <option value="">Выберите группу</option>
                    {details.groups.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
                  </select>
                </label> : null}
                {(!hasGroups || groupId) ? <label className="grid gap-1 text-sm">Дата
                  <Input type="date" required className="min-h-11 text-base" value={offerDate}
                    onChange={(event) => { setOfferDate(event.target.value); setOfferChoiceIndex(""); setError(""); }} />
                </label> : null}
                {offerDate && (!hasGroups || groupId) ? <label className="grid gap-1 text-sm">Время
                  <select className={selectClass} required value={offerChoiceIndex} onChange={(event) => setOfferChoiceIndex(event.target.value)}>
                    <option value="">{!choices ? "Загружаем…" : choices.length ? "Выберите слот" : "Доступных слотов нет"}</option>
                    {choices?.map((option, index) => (
                      <option value={index} key={option.startsAt + option.endsAt}>
                        {formatHHMM(option.startsAt, details.timezone)}–{formatHHMM(option.endsAt, details.timezone)}
                      </option>
                    ))}
                  </select>
                </label> : null}
                {choice && tariffs?.length ? <label className="grid gap-1 text-sm" key={"tariff:" + offerChoiceIndex}>Тариф
                  <select className={selectClass} required name="tariff" defaultValue="">
                    <option value="">Выберите тариф</option>
                    {tariffs.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </label> : null}
                {needsResourcePicker ? <label className="grid gap-1 text-sm" key={"unit:" + offerChoiceIndex}>Ресурс
                  <select className={selectClass} required name="unit" defaultValue="">
                    <option value="">Выберите ресурс</option>
                    {unitIds.map((id, index) => <option key={id} value={id}>{details?.units[id] ?? `Ресурс ${index + 1}`}</option>)}
                  </select>
                </label> : null}
              </>
            ) : null}
            {type === "PLACE" && publicationId ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid min-w-0 gap-1 text-sm">Дата
                    <Input type="date" name="date" className="min-h-11 text-base"
                      required={reservePlaceResource} value={placeDate} onChange={(event) => setPlaceDate(event.target.value)} />
                  </label>
                  <label className="grid min-w-0 gap-1 text-sm">Время
                    <Input type="time" name="time" className="min-h-11 text-base"
                      required={reservePlaceResource} value={placeTime} onChange={(event) => setPlaceTime(event.target.value)} />
                  </label>
                </div>
                {placeUnits === undefined && reservePlaceResource && !placeResourceError
                  ? <p role="status" className="text-xs text-stone-500">Загружаем доступные ресурсы…</p> : null}
                {placeResourceError && reservePlaceResource
                  ? <p role="alert" className="text-sm text-destructive">{placeResourceError}</p> : null}
                {bookingStatus === "CONFIRMED" ? (
                  <label className="flex items-start gap-3 rounded-xl border border-stone-200 p-3 text-sm">
                    <input type="checkbox" className="mt-1 size-4 shrink-0 accent-orange-500"
                      checked={reservePlaceResource} onChange={(event) => setReservePlaceResource(event.target.checked)} />
                    <span>
                      <span className="block font-semibold text-stone-900">Занять время исполнителя или зала</span>
                      <span className="mt-1 block text-xs leading-5 text-stone-500">
                        Проверим доступность и закроем время для других записей.
                      </span>
                    </span>
                  </label>
                ) : null}
                {reservePlaceResource && placeUnits?.length === 0 ? (
                  <p role="alert" className="text-xs leading-5 text-stone-600">
                    Для этого места нет доступных ресурсов. Создайте исполнителя или зал в разделе
                    «Ресурсы и расписание» либо снимите выбор «Занять время», чтобы добавить заявку без блокировки.
                  </p>
                ) : null}
                {reservePlaceResource && bookingStatus === "CONFIRMED" ? (
                  <div className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50/50 p-3">
                    <label className="grid gap-1 text-sm">Исполнитель или зал
                      <select className={selectClass} required
                        value={selectedPlaceUnit?.id ?? ""}
                        onChange={(event) => setPlaceResourceId(event.target.value)}>
                        <option value="">Выберите ресурс</option>
                        {placeUnits?.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm">Продолжительность
                      <select className={selectClass} required value={selectedDuration}
                        onChange={(event) => setPlaceDuration(Number(event.target.value))}>
                        {durations.map((minutes) =>
                          <option key={minutes} value={minutes}>{durationLabel(minutes)}</option>)}
                      </select>
                    </label>
                    {selectedPlaceUnit && placeReservation && placeStart && placeEnd ? (
                      <p className="text-xs leading-5 text-stone-600">
                        Ресурс будет занят с {dateTimeLabel(
                          placeReservation.blockStart, selectedPlaceUnit.timezone,
                        )} до {dateTimeLabel(
                          placeReservation.blockEnd, selectedPlaceUnit.timezone,
                        )} (включая подготовку и уборку).
                        Окончательную доступность проверим при сохранении.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs leading-5 text-stone-500">
                    Без выбора ресурса запись появится в списке и, при наличии даты, в календаре,
                    но не закроет время исполнителя или зала.
                  </p>
                )}
              </>
            ) : type === "OFFER" && publicationId && !scheduledOffer ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="grid min-w-0 gap-1 text-sm">Дата<Input type="date" name="date" className="min-h-11 text-base" /></label>
                <label className="grid min-w-0 gap-1 text-sm">Время<Input type="time" name="time" className="min-h-11 text-base" /></label>
              </div>
            ) : null}
            <h3 className="border-t border-stone-200 pt-4 text-sm font-semibold text-stone-950">2. Данные клиента</h3>
            <label className="grid gap-1 text-sm">Имя клиента<Input name="name" required minLength={2} maxLength={120} className="min-h-11 text-base" /></label>
            <label className="grid gap-1 text-sm">Телефон<Input name="phone" type="tel" required minLength={7} maxLength={20} className="min-h-11 text-base" /></label>
            <details className="rounded-xl border border-stone-200 px-3 py-3">
              <summary className="cursor-pointer text-sm font-medium text-stone-700">
                Дополнительно: email, участники, комментарий
              </summary>
              <div className="mt-3 grid gap-3">
                <label className="grid gap-1 text-sm">Email, необязательно<Input name="email" type="email" maxLength={254} className="min-h-11 text-base" /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1 text-sm">Взрослые<Input name="adults" type="number" min={0} max={100} defaultValue={1} required className="min-h-11 text-base" /></label>
                  <label className="grid gap-1 text-sm">Дети<Input name="children" type="number" min={0} max={100} defaultValue={0} required className="min-h-11 text-base" /></label>
                </div>
                <label className="grid gap-1 text-sm">Комментарий, необязательно<Textarea name="comment" maxLength={500} className="text-base" /></label>
              </div>
            </details>
            <label className="grid gap-1 text-sm">Создать как
              <select className={selectClass} name="status" value={bookingStatus} onChange={(event) => {
                const next = event.target.value as "NEW" | "CONFIRMED";
                setBookingStatus(next);
                if (next !== "CONFIRMED") setReservePlaceResource(false);
              }}>
                <option value="CONFIRMED">Подтверждена</option>
                <option value="NEW">Требует подтверждения</option>
              </select>
            </label>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="min-h-11" disabled={!ready || busy}>
              {busy ? "Сохраняем…" : "Добавить запись"}
            </Button>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
