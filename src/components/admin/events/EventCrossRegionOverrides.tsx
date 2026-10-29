"use client";

import { useEffect, useState } from "react";

type Region = { id: string; name: string };
type Override = { id: string; regionId: string; reason: string; expiresAt: string };

export function EventCrossRegionOverrides({ activityId }: { activityId: string }) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [rows, setRows] = useState<Override[]>([]);
  const [regionId, setRegionId] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [message, setMessage] = useState("");
  const endpoint = "/api/admin/discovery/cross-region-overrides";

  async function refresh() {
    const [regionResponse, rowResponse] = await Promise.all([
      fetch(endpoint), fetch(endpoint + "?activityId=" + encodeURIComponent(activityId)),
    ]);
    if (!regionResponse.ok || !rowResponse.ok) { setMessage("Не удалось загрузить настройки"); return; }
    setRegions((await regionResponse.json() as { regions: Region[] }).regions);
    setRows(await rowResponse.json() as Override[]);
  }
  useEffect(() => { void refresh(); }, [activityId]);

  async function save() {
    if (!regionId || reason.trim().length < 5 || !expiresAt) { setMessage("Укажите область, причину и дату"); return; }
    const date = new Date(expiresAt);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) { setMessage("Дата должна быть в будущем"); return; }
    const response = await fetch(endpoint, { method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId, regionId, reason, expiresAt: date.toISOString() }) });
    setMessage(response.ok ? "Исключение сохранено" : "Не удалось сохранить исключение");
    if (response.ok) await refresh();
  }

  async function remove(targetRegionId: string) {
    const params = new URLSearchParams({ activityId, regionId: targetRegionId });
    const response = await fetch(endpoint + "?" + params, { method: "DELETE" });
    setMessage(response.ok ? "Исключение удалено" : "Не удалось удалить исключение");
    if (response.ok) await refresh();
  }

  return <section className="space-y-3 rounded-xl border p-4" aria-label="Редакционная география">
    <h2 className="font-semibold">Дополнительная география — только редакция</h2>
    <p className="text-sm text-muted-foreground">Обычно охват рассчитывается автоматически: 50 уникальных семей. Исключения не заменяют пользовательские фильтры и не относятся к Boost.</p>
    <label className="block text-sm">Область
      <select className="block w-full rounded border p-2" value={regionId} onChange={e => setRegionId(e.target.value)}>
        <option value="">Выберите область</option>{regions.map(r => <option value={r.id} key={r.id}>{r.name}</option>)}
      </select>
    </label>
    <label className="block text-sm">Причина
      <textarea className="block w-full rounded border p-2" maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} />
    </label>
    <label className="block text-sm">Действует до
      <input className="block w-full rounded border p-2" type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
    </label>
    <button type="button" className="rounded border px-3 py-2" onClick={() => void save()}>Сохранить исключение</button>
    {message && <p role="status">{message}</p>}
    {rows.map(row => <div key={row.id} className="flex items-center justify-between gap-2 border-t py-2 text-sm">
      <span>{regions.find(r => r.id === row.regionId)?.name ?? row.regionId}: {row.reason} (до {new Date(row.expiresAt).toLocaleString("ru-RU")})</span>
      <button type="button" className="underline" onClick={() => void remove(row.regionId)}>Удалить</button>
    </div>)}
  </section>;
}
