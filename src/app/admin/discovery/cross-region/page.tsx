"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

type Region = { id: string; name: string; crossRegionFamilyThreshold: number | null };
type Override = { id: string; regionId: string; reason: string; expiresAt: string; createdById: string };

export default function CrossRegionSettingsPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [activityId, setActivityId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadRegions() {
    const response = await fetch("/api/admin/discovery/cross-region-thresholds");
    if (!response.ok) { setError("Недостаточно прав для настройки порогов"); return; }
    setRegions(await response.json() as Region[]);
  }
  useEffect(() => { void loadRegions(); }, []);

  async function saveThreshold(region: Region, value: string) {
    setError(""); setNotice("");
    const threshold = value.trim() === "" ? null : Number(value);
    if (threshold !== null && (!Number.isInteger(threshold) || threshold < 1 || threshold > 1000000)) {
      setError("Порог должен быть целым числом от 1 до 1000000"); return;
    }
    const response = await fetch("/api/admin/discovery/cross-region-thresholds", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regionId: region.id, threshold }),
    });
    if (!response.ok) { setError("Не удалось сохранить порог"); return; }
    setNotice("Порог сохранён");
    await loadRegions();
  }

  async function loadOverrides(id: string) {
    if (!id.trim()) { setOverrides([]); return; }
    const response = await fetch("/api/admin/discovery/cross-region-overrides?activityId=" + encodeURIComponent(id));
    if (!response.ok) { setError("Не удалось загрузить исключения"); return; }
    setOverrides(await response.json() as Override[]);
  }

  async function saveOverride() {
    setError(""); setNotice("");
    const response = await fetch("/api/admin/discovery/cross-region-overrides", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId, regionId, reason, expiresAt: new Date(expiresAt).toISOString() }),
    });
    if (!response.ok) { setError("Не удалось сохранить исключение"); return; }
    setNotice("Исключение сохранено");
    await loadOverrides(activityId);
  }

  async function removeOverride(targetRegionId: string) {
    const params = new URLSearchParams({ activityId, regionId: targetRegionId });
    const response = await fetch("/api/admin/discovery/cross-region-overrides?" + params, { method: "DELETE" });
    if (!response.ok) { setError("Не удалось удалить исключение"); return; }
    await loadOverrides(activityId);
  }

  return <main className="space-y-8 p-6">
    <header><h1 className="text-2xl font-semibold">Межрегиональная выдача</h1>
      <p className="text-sm text-gray-600">Порог по умолчанию — 50 уникальных семей. Редакционные исключения действуют до указанной даты.</p></header>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <section className="space-y-3"><h2 className="text-lg font-semibold">Пороги по областям (только администратор)</h2>
      {regions.map(region => <ThresholdRow key={region.id} region={region} save={saveThreshold} />)}
    </section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Редакционные исключения</h2>
      <label className="block">ID события <Input value={activityId} onChange={e => setActivityId(e.target.value)} /></label>
      <button type="button" className="rounded border px-3 py-2" onClick={() => void loadOverrides(activityId)}>Загрузить исключения</button>
      <label className="block">Целевая область <select className="block w-full rounded border p-2" value={regionId} onChange={e => setRegionId(e.target.value)}>
        <option value="">Выберите область</option>{regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select></label>
      <label className="block">Причина <Input value={reason} onChange={e => setReason(e.target.value)} /></label>
      <label className="block">Действует до <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} /></label>
      <button type="button" className="rounded border px-3 py-2" disabled={!activityId || !regionId || !reason || !expiresAt} onClick={() => void saveOverride()}>Сохранить исключение</button>
      {overrides.map(o => <div className="flex items-center gap-3 border-b py-2" key={o.id}>
        <span>{regions.find(r => r.id === o.regionId)?.name ?? o.regionId} · {o.reason} · до {new Date(o.expiresAt).toLocaleString("ru-RU")}</span>
        <button type="button" className="underline" onClick={() => void removeOverride(o.regionId)}>Удалить</button>
      </div>)}
    </section>
  </main>;
}

function ThresholdRow({ region, save }: { region: Region; save: (region: Region, value: string) => Promise<void> }) {
  const [value, setValue] = useState(region.crossRegionFamilyThreshold?.toString() ?? "");
  useEffect(() => { setValue(region.crossRegionFamilyThreshold?.toString() ?? ""); }, [region.crossRegionFamilyThreshold]);
  return <div className="flex items-center gap-3" >
    <span className="w-48">{region.name}</span>
    <Input className="max-w-32" type="number" min={1} max={1000000} placeholder="50" value={value} onChange={e => setValue(e.target.value)} />
    <button type="button" className="rounded border px-3 py-2" onClick={() => void save(region, value)}>Сохранить</button>
  </div>;
}
