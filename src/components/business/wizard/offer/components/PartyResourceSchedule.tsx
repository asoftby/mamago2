"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PartyResourceEditor } from "./PartyResourceEditor";

type Unit = { id: string; name: string; status: string; offers: { offerId: string }[] };
const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const minutes = (time: string): number => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

/** Uses the business booking inventory, not publication opening hours.
 * Existing resources are only listed, never silently overwritten.
 */
export function PartyResourceSchedule({ offerId }: { offerId: string | null }) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<number[]>([1, 2, 3, 4, 5]);
  const [from, setFrom] = useState("10:00");
  const [to, setTo] = useState("20:00");
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState(1);
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refresh = async () => {
    const res = await fetch("/api/business/booking-units", { cache: "no-store" });
    if (!res.ok) throw new Error("Не удалось загрузить ресурсы");
    const data = await res.json() as { units: Unit[] };
    setUnits(data.units.filter(unit => unit.offers.some(link => link.offerId === offerId)));
  };
  useEffect(() => {
    if (!offerId) return;
    void refresh().catch(e => setError(e instanceof Error ? e.message : "Ошибка загрузки"));
  }, [offerId]);

  const create = async () => {
    if (!offerId || pending) return;
    setError(""); setSuccess("");
    if (!name.trim() || selected.length === 0 || minutes(from) >= minutes(to) ||
      duration > minutes(to) - minutes(from)) {
      setError("Проверьте название, дни, интервал и минимальную длительность.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/business/booking-units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), offerIds: [offerId], capacity,
          prepMinutes: 0, cleanupMinutes: 0,
          minDurationMinutes: duration, stepMinutes: 30,
          rules: selected.map(weekday => ({
            weekday, startMinutes: minutes(from), endMinutes: minutes(to),
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || "Не удалось сохранить расписание ресурса");
      }
      await refresh();
      setName(""); setSuccess("Ресурс и его расписание сохранены.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border p-4" aria-label="Доступность праздничных ресурсов">
      <div>
        <h3 className="text-base font-semibold">Ресурсы и доступные интервалы</h3>
        <p className="text-sm text-muted-foreground">
          Здесь настраивается календарный ресурс для бронирования, отдельно от общих часов работы.
          Фактические слоты рассчитываются с учётом занятости и блокировок.
        </p>
      </div>
      {!offerId ? (
        <p className="text-sm text-muted-foreground">
          Сначала сохраните предложение как черновик, затем создайте ресурс и его расписание.
        </p>
      ) : (
        <>
          {units.length > 0 && <div className="space-y-1 text-sm">
            <p className="font-medium">Привязанные ресурсы</p>
            {units.map(unit => <div key={unit.id} className="space-y-2"><div className="flex items-center gap-2"><span>{unit.name} — {unit.status}</span><Button type="button" variant="outline" size="sm" onClick={() => setEditingId(current => current === unit.id ? null : unit.id)}>Изменить</Button></div>{editingId === unit.id && <PartyResourceEditor unitId={unit.id} offerId={offerId} onSaved={() => void refresh()} />}</div>)}
          </div>}
          <div className="space-y-2">
            <Label htmlFor="party-resource-name">Название ресурса</Label>
            <Input id="party-resource-name" value={name} maxLength={120}
              placeholder="Например, праздничный зал" onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Дни доступности</p>
            <div className="flex flex-wrap gap-2">
              {days.map((day, index) => <Button type="button" key={day} size="sm"
                variant={selected.includes(index + 1) ? "default" : "outline"}
                onClick={() => setSelected(old => old.includes(index + 1)
                  ? old.filter(value => value !== index + 1) : [...old, index + 1])}>
                {day}
              </Button>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1"><Label htmlFor="party-from">С</Label>
              <Input id="party-from" type="time" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="party-to">До</Label>
              <Input id="party-to" type="time" value={to} onChange={e => setTo(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="party-duration">Минимум, мин</Label>
              <Input id="party-duration" type="number" min={15} max={1440} step={15}
                value={duration} onChange={e => setDuration(Number(e.target.value))} /></div>
            <div className="space-y-1"><Label htmlFor="party-capacity">Вместимость</Label>
              <Input id="party-capacity" type="number" min={1} max={1000}
                value={capacity} onChange={e => setCapacity(Number(e.target.value))} /></div>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {success && <p role="status" className="text-sm">{success}</p>}
          <Button type="button" onClick={() => void create()} disabled={pending}>
            {pending ? "Сохранение…" : "Добавить ресурс и расписание"}
          </Button>
        </>
      )}
    </section>
  );
}
