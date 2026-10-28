"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CalendarClock, Pencil, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import {
  WEEKDAYS, asMinutes, asTime, emptyUnitForm, fromUnitDetail, toUnitPayload,
  type DateException, type UnitDetail, type UnitForm, type UnitSummary, type WeekRule,
} from "./bookingUnitForm";

type OfferOption = { id: string; title: string; status: string };
type ApiError = { error?: string };
const API = "/api/business/booking-units";

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body: ApiError = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "Не удалось выполнить действие");
  }
  return body as unknown as T;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-stone-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

const numberProps = { type: "number", min: 0, step: 1 } as const;

export function BookingUnitManager({ offers }: { offers: OfferOption[] }) {
  const [units, setUnits] = useState<UnitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UnitForm | null>(null);

  async function reload() {
    const data = await getJson<{ units: UnitSummary[] }>(API);
    setUnits(data.units);
  }

  useEffect(() => {
    let alive = true;
    getJson<{ units: UnitSummary[] }>(API)
      .then(data => { if (alive) setUnits(data.units); })
      .catch(err => { if (alive) setError(err instanceof Error ? err.message : "Ошибка загрузки"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  function createUnit() {
    setError("");
    setNotice("");
    setEditingId(null);
    setForm(emptyUnitForm());
  }

  async function editUnit(id: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await getJson<{ unit: UnitDetail }>(API + "/" + encodeURIComponent(id));
      setForm(fromUnitDetail(data.unit));
      setEditingId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось открыть ресурс");
    } finally { setBusy(false); }
  }

  function patch(p: Partial<UnitForm>) {
    setForm(old => old ? { ...old, ...p } : old);
  }

  function patchRule(index: number, fields: Partial<WeekRule>) {
    setForm(old => old ? {
      ...old,
      rules: old.rules.map((rule, i) => i === index ? { ...rule, ...fields } : rule),
    } : old);
  }

  function addRule(weekday: number) {
    setForm(old => {
      if (!old) return old;
      const ends = old.rules.filter(rule => rule.weekday === weekday).map(rule => rule.endMinutes);
      const start = ends.length ? Math.min(ends[ends.length - 1], 1320) : 600;
      return { ...old, rules: [...old.rules, { weekday, startMinutes: start, endMinutes: Math.min(1440, start + 120) }] };
    });
  }

  function patchException(index: number, fields: Partial<DateException>) {
    setForm(old => old ? {
      ...old,
      exceptions: old.exceptions.map((item, i) => i === index ? { ...item, ...fields } : item),
    } : old);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || busy) return;
    if (form.rules.length === 0 || form.offerIds.length === 0) {
      setError("Выберите хотя бы одно предложение и добавьте рабочий интервал");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const id = editingId;
      await getJson(id ? API + "/" + encodeURIComponent(id) : API, {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toUnitPayload(form)),
      });
      await reload();
      setForm(null);
      setEditingId(null);
      setNotice(id ? "Ресурс обновлён" : "Ресурс создан");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-700">{notice}</p> : null}

      {!form ? (
        <BusinessSurfaceCard className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-950">Мои ресурсы</h2>
              <p className="mt-1 text-sm text-stone-600">Площадки, комнаты и исполнители, доступные для бронирования праздников.</p>
            </div>
            <Button onClick={createUnit} disabled={busy || offers.length === 0}><Plus /> Добавить ресурс</Button>
          </div>
          {loading ? <p className="text-sm text-stone-600">Загрузка ресурсов…</p> : null}
          {!loading && units.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 p-6 text-sm text-stone-600">
              Ресурсов пока нет. Добавьте первый ресурс и привяжите к нему предложение для детского праздника.
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            {units.map(unit => (
              <div key={unit.id} className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-stone-950">{unit.name}</h3>
                    <p className="mt-1 text-xs text-stone-600">{unit.status === "ACTIVE" ? "Активен" : "Выключен"} · Услуг: {unit.offers.length} · Интервалов: {unit.rules.length}</p>
                    {unit.capacity ? <p className="mt-1 text-xs text-stone-600">Вместимость: {unit.capacity}</p> : null}
                  </div>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void editUnit(unit.id)}>
                    <Pencil /> Изменить
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {!loading && offers.length === 0 ? (
            <p className="text-sm text-stone-600">Для создания ресурса сначала добавьте предложение категории «Детский праздник» и привяжите его к своему месту.</p>
          ) : null}
        </BusinessSurfaceCard>
      ) : (
        <form onSubmit={event => void save(event)} className="space-y-5">
          <BusinessSurfaceCard className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-stone-950">{editingId ? "Редактировать ресурс" : "Новый ресурс"}</h2>
              <Button type="button" variant="outline" onClick={() => { setForm(null); setEditingId(null); setError(""); }} disabled={busy}>
                <X /> Закрыть
              </Button>
            </div>
            {editingId ? (
              <p className="rounded-lg bg-stone-100 p-3 text-sm text-stone-600">
                Изменение настроек запрещено, если у ресурса есть будущая подтверждённая бронь или действующий резерв. Если ресурс изменил другой сотрудник, перед сохранением потребуется загрузить актуальную версию.
              </p>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название ресурса">
                <Input required maxLength={120} value={form.name} onChange={e => patch({ name: e.target.value })} placeholder="Например, игровая комната" />
              </Field>
              {editingId ? (
                <Field label="Статус">
                  <select className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm" value={form.status} onChange={e => patch({ status: e.target.value as UnitForm["status"] })}>
                    <option value="ACTIVE">Активен</option><option value="INACTIVE">Неактивен</option>
                  </select>
                </Field>
              ) : null}
              <Field label="Вместимость (человек, необязательно)">
                <Input {...numberProps} min={1} max={1000} value={form.capacity} onChange={e => patch({ capacity: e.target.value })} placeholder="Без ограничения" />
              </Field>
              <Field label="Минимальная длительность (мин, необязательно)">
                <Input {...numberProps} min={15} max={1440} value={form.minDurationMinutes} onChange={e => patch({ minDurationMinutes: e.target.value })} />
              </Field>
              <Field label="Подготовка до начала (мин)">
                <Input {...numberProps} max={240} required value={form.prepMinutes} onChange={e => patch({ prepMinutes: e.target.value })} />
              </Field>
              <Field label="Уборка после (мин)">
                <Input {...numberProps} max={240} required value={form.cleanupMinutes} onChange={e => patch({ cleanupMinutes: e.target.value })} />
              </Field>
              <Field label="Шаг записи (мин)">
                <Input type="number" min={5} max={240} step={1} required value={form.stepMinutes} onChange={e => patch({ stepMinutes: e.target.value })} />
              </Field>
            </div>
          </BusinessSurfaceCard>

          <BusinessSurfaceCard className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Предложения</h3>
              <p className="mt-1 text-sm text-stone-600">Выберите услуги, для которых доступен этот ресурс.</p>
            </div>
            <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
              {offers.map(offer => (
                <label key={offer.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 p-3 text-sm">
                  <input type="checkbox" className="mt-1 size-4 accent-primary" checked={form.offerIds.includes(offer.id)} onChange={event => patch({
                    offerIds: event.target.checked ? [...form.offerIds, offer.id] : form.offerIds.filter(id => id !== offer.id),
                  })} />
                  <span>{offer.title}<span className="block text-xs text-stone-500">{offer.status}</span></span>
                </label>
              ))}
            </div>
          </BusinessSurfaceCard>

          <BusinessSurfaceCard className="space-y-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-5 text-stone-600" />
              <h3 className="text-lg font-semibold">Рабочие часы</h3>
            </div>
            <p className="text-sm text-stone-600">Несколько интервалов в день допустимы. Время указано для Минска; интервалы не должны пересекаться.</p>
            <div className="space-y-3">
              {WEEKDAYS.map((day, dayIndex) => {
                const weekday = dayIndex + 1;
                const dayRules = form.rules.map((rule, index) => ({ rule, index })).filter(item => item.rule.weekday === weekday);
                return (
                  <div key={weekday} className="rounded-xl border border-stone-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{day}</span>
                      <Button type="button" size="sm" variant="outline" onClick={() => addRule(weekday)}><Plus /> Интервал</Button>
                    </div>
                    {dayRules.length === 0 ? <p className="mt-2 text-xs text-stone-500">Выходной</p> : null}
                    <div className="mt-2 space-y-2">
                      {dayRules.map(({ rule, index }) => (
                        <div className="flex flex-wrap items-center gap-2" key={index}>
                          <input aria-label={day + ": начало"} type="time" required className="h-10 rounded-md border border-stone-300 bg-white px-2 text-sm" value={asTime(rule.startMinutes)} onChange={e => patchRule(index, { startMinutes: asMinutes(e.target.value) })} />
                          <span className="text-stone-500">—</span>
                          {rule.endMinutes === 1440 ? <span className="text-sm font-medium">24:00</span> : (
                            <input aria-label={day + ": окончание"} type="time" required className="h-10 rounded-md border border-stone-300 bg-white px-2 text-sm" value={asTime(rule.endMinutes)} onChange={e => patchRule(index, { endMinutes: asMinutes(e.target.value) })} />
                          )}
                          <label className="flex items-center gap-1 text-xs text-stone-600">
                            <input type="checkbox" checked={rule.endMinutes === 1440} onChange={e => patchRule(index, { endMinutes: e.target.checked ? 1440 : 1080 })} />
                            До 24:00
                          </label>
                          <Button type="button" aria-label={day + ": удалить интервал"} variant="ghost" size="icon" onClick={() => patch({ rules: form.rules.filter((_, i) => i !== index) })}><X /></Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </BusinessSurfaceCard>

          {editingId ? (
            <BusinessSurfaceCard className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Исключения и закрытые даты</h3>
                <p className="mt-1 text-sm text-stone-600">Закройте день целиком, часть дня или добавьте дополнительные часы на конкретную дату.</p>
              </div>
              {form.exceptions.map((exception, index) => (
                <div key={index} className="space-y-3 rounded-xl border border-stone-200 p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="Дата">
                      <Input type="date" required value={exception.date} onChange={e => patchException(index, { date: e.target.value })} />
                    </Field>
                    <Field label="Изменение">
                      <select value={exception.kind} className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm" onChange={e => patchException(index, { kind: e.target.value as DateException["kind"] })}>
                        <option value="CLOSED">Закрыто</option>
                        <option value="OPEN_OVERRIDE">Открыто дополнительно</option>
                      </select>
                    </Field>
                    <Button type="button" variant="ghost" onClick={() => patch({ exceptions: form.exceptions.filter((_, i) => i !== index) })}><X /> Удалить</Button>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input type="checkbox" className="size-4 accent-primary" checked={exception.startMinutes === null} onChange={e => patchException(index, e.target.checked
                      ? { startMinutes: null, endMinutes: null }
                      : { startMinutes: 600, endMinutes: 1080 })} />
                    Весь день
                  </label>
                  {exception.startMinutes !== null && exception.endMinutes !== null ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input aria-label="Начало исключения" type="time" required className="h-10 rounded-md border border-stone-300 px-2 text-sm" value={asTime(exception.startMinutes)} onChange={e => patchException(index, { startMinutes: asMinutes(e.target.value) })} />
                      <span>—</span>
                      {exception.endMinutes === 1440 ? <span className="text-sm font-medium">24:00</span> : (
                        <input aria-label="Конец исключения" type="time" required className="h-10 rounded-md border border-stone-300 px-2 text-sm" value={asTime(exception.endMinutes)} onChange={e => patchException(index, { endMinutes: asMinutes(e.target.value) })} />
                      )}
                      <label className="flex items-center gap-1 text-xs text-stone-600">
                        <input type="checkbox" checked={exception.endMinutes === 1440} onChange={e => patchException(index, { endMinutes: e.target.checked ? 1440 : 1080 })} />
                        До 24:00
                      </label>
                    </div>
                  ) : null}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => patch({
                exceptions: [...form.exceptions, { date: "", kind: "CLOSED", startMinutes: null, endMinutes: null }],
              })}><Plus /> Добавить исключение</Button>
            </BusinessSurfaceCard>
          ) : (
            <p className="text-sm text-stone-600">Закрытые даты можно добавить сразу после создания ресурса через «Изменить».</p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy}>{busy ? "Сохранение…" : editingId ? "Сохранить изменения" : "Создать ресурс"}</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => { setForm(null); setEditingId(null); setError(""); }}>Отмена</Button>
            {editingId ? <Button type="button" variant="ghost" disabled={busy} onClick={() => void editUnit(editingId)}><RefreshCw /> Загрузить актуальную версию</Button> : null}
          </div>
        </form>
      )}
    </div>
  );
}
