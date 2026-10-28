"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";

type Window = { blockStart: string; blockEnd: string };
type Block = Window & { id: string; source: "MANUAL" | "EXTERNAL"; note: string | null };
type Allocation = Window & { status: "HELD" | "CONFIRMED" };
type ResponseData = { blocks: Block[]; allocations: Allocation[] };
const formatter = new Intl.DateTimeFormat("ru-BY", { timeZone: "Europe/Minsk", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
function dateLabel(date: string) { return formatter.format(new Date(date)); }
/** A datetime-local input represents Minsk wall time; force +03:00 independently of browser timezone. */
function minskISO(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("Укажите дату и время");
  const instant = new Date(value + ":00+03:00");
  if (!Number.isFinite(instant.getTime())) throw new Error("Неверная дата");
  return instant.toISOString();
}
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "Операция не выполнена");
  return payload as T;
}

export function BookingUnitCalendar({ unitId }: { unitId: string }) {
  const endpoint = "/api/business/booking-units/" + encodeURIComponent(unitId) + "/blocks";
  const [windows, setWindows] = useState<ResponseData | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    api<ResponseData>(endpoint).then(data => { if (active) setWindows(data); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Не удалось загрузить занятость"); });
    return () => { active = false; };
  }, [endpoint]);

  async function refresh() { setWindows(await api<ResponseData>(endpoint)); }
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockStart: minskISO(start), blockEnd: minskISO(end), note: note.trim() || null }) });
      await refresh(); setStart(""); setEnd(""); setNote(""); setNotice("Время закрыто для бронирования");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setBusy(false); }
  }
  async function remove(blockId: string) {
    if (busy || !window.confirm("Удалить ручную блокировку?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api(endpoint, { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockId }) });
      await refresh(); setNotice("Блокировка удалена");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setBusy(false); }
  }
  return (
    <BusinessSurfaceCard className="space-y-4">
      <h3 className="text-lg font-semibold">Занятость и ручные блокировки</h3>
      <p className="text-sm text-stone-600">Ближайший 31 день. Время Минска. Подтверждённые бронирования нельзя удалить из расписания.</p>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="text-sm text-stone-700">{notice}</p> : null}
      <form onSubmit={event => void add(event)} className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">Начало блокировки <Input type="datetime-local" required value={start} onChange={event => setStart(event.target.value)} /></label>
        <label className="text-sm">Окончание блокировки <Input type="datetime-local" required value={end} onChange={event => setEnd(event.target.value)} /></label>
        <label className="text-sm md:col-span-2">Причина (необязательно) <Input maxLength={500} value={note} onChange={event => setNote(event.target.value)} placeholder="Например, частный праздник" /></label>
        <div className="md:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Сохранение…" : "Закрыть время"}</Button></div>
      </form>
      {!windows ? <p className="text-sm text-stone-600">Загрузка занятости…</p> : (
        <div className="space-y-2">
          {windows.blocks.length + windows.allocations.length === 0 ? <p className="text-sm text-stone-600">Занятых интервалов нет.</p> : null}
          {windows.allocations.map((entry, i) => (
            <div key={"a-" + i} className="rounded-lg border border-stone-200 p-3 text-sm">
              <strong>{entry.status === "CONFIRMED" ? "Подтверждено" : "Резерв"}</strong> · {dateLabel(entry.blockStart)} — {dateLabel(entry.blockEnd)}
            </div>
          ))}
          {windows.blocks.map(entry => (
            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 p-3 text-sm">
              <span><strong>{entry.source === "MANUAL" ? "Закрыто вручную" : "Внешняя блокировка"}</strong> · {dateLabel(entry.blockStart)} — {dateLabel(entry.blockEnd)}{entry.note ? " · " + entry.note : ""}</span>
              {entry.source === "MANUAL" ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void remove(entry.id)}>Удалить</Button> : null}
            </div>
          ))}
        </div>
      )}
      <Button type="button" variant="outline" disabled={busy} onClick={() => { setError(""); void refresh().catch(e => setError(e instanceof Error ? e.message : "Ошибка")); }}>Обновить занятость</Button>
    </BusinessSurfaceCard>
  );
}
