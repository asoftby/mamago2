"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Rule = { weekday: number; startMinutes: number; endMinutes: number };
type Exception = { date: string; kind: "CLOSED" | "OPEN_OVERRIDE"; startMinutes: number | null; endMinutes: number | null };
type Resource = {
  id: string; name: string; status: "ACTIVE" | "INACTIVE"; updatedAt: string;
  capacity: number | null; prepMinutes: number; cleanupMinutes: number;
  minDurationMinutes: number | null; stepMinutes: number;
  rules: Rule[]; exceptions: Array<Omit<Exception,"date"> & {date: string}>;
  offers: {offerId: string}[];
};
const clock = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const minute = (s: string) => {const [h,m] = s.split(":").map(Number);return h * 60 + m;};
const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function PartyResourceEditor({ unitId, offerId, onSaved }: {
  unitId: string; offerId: string; onSaved: () => void;
}) {
  const [unit, setUnit] = useState<Resource | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Resource["status"]>("ACTIVE");
  const [capacity, setCapacity] = useState("1");
  const [duration, setDuration] = useState("60");
  const [rules, setRules] = useState<Rule[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    const res = await fetch(`/api/business/booking-units/${encodeURIComponent(unitId)}`, {cache:"no-store"});
    const json = await res.json() as {unit?: Resource;error?:string};
    if (!res.ok || !json.unit) throw new Error(json.error || "Не удалось прочитать ресурс");
    const value = json.unit;
    if (!value.offers.some(link => link.offerId === offerId)) throw new Error("Ресурс не привязан к предложению");
    setUnit(value);setName(value.name);setStatus(value.status);
    setCapacity(String(value.capacity ?? 1));setDuration(String(value.minDurationMinutes ?? 60));
    setRules(value.rules);setExceptions(value.exceptions.map(e => ({...e,date:e.date.slice(0,10)})));
  };
  useEffect(() => {void load().catch(e=>setError(String(e)));}, [unitId, offerId]);
  const save = async () => {
    if (!unit || busy) return;
    setError("");setMessage("");
    const cap = Number(capacity), min = Number(duration);
    if (!name.trim() || !Number.isInteger(cap) || cap < 1 || cap > 1000 ||
        !Number.isInteger(min) || min < 15 || min > 1440 || rules.length === 0) {
      setError("Проверьте название, вместимость, длительность и интервалы.");return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/business/booking-units/${encodeURIComponent(unitId)}`, {
        method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          expectedUpdatedAt:unit.updatedAt, status, name:name.trim(), capacity:cap,
          prepMinutes:unit.prepMinutes, cleanupMinutes:unit.cleanupMinutes,
          minDurationMinutes:min, stepMinutes:unit.stepMinutes,
          offerIds:unit.offers.map(link=>link.offerId),rules,exceptions,
        }),
      });
      const json = await res.json() as {error?:string};
      if (!res.ok) throw new Error(json.error || "Не удалось сохранить ресурс");
      await load();onSaved();setMessage("Расписание ресурса сохранено");
    } catch(e) {setError(e instanceof Error?e.message:"Ошибка сохранения");}
    finally {setBusy(false);}
  };
  return (
    <section className="space-y-3 rounded-xl border p-3" aria-label="Редактирование праздничного ресурса">
      <h4 className="font-medium">Изменить ресурс</h4>
      {!unit ? <p className="text-sm">{error || "Загрузка…"}</p> : <>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label htmlFor={`unit-name-${unitId}`}>Название</Label>
            <Input id={`unit-name-${unitId}`} value={name} onChange={e=>setName(e.target.value)}/></div>
          <div><Label htmlFor={`unit-cap-${unitId}`}>Вместимость</Label>
            <Input id={`unit-cap-${unitId}`} type="number" min={1} max={1000} value={capacity} onChange={e=>setCapacity(e.target.value)}/></div>
          <div><Label htmlFor={`unit-duration-${unitId}`}>Минимум, мин</Label>
            <Input id={`unit-duration-${unitId}`} type="number" min={15} max={1440} value={duration} onChange={e=>setDuration(e.target.value)}/></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={status==="ACTIVE"}
          onChange={e=>setStatus(e.target.checked?"ACTIVE":"INACTIVE")}/> Ресурс активен</label>
        <p className="text-sm font-medium">Еженедельные интервалы</p>
        {rules.map((rule,i)=><div className="flex flex-wrap items-center gap-2" key={i}>
          <select aria-label="День недели" value={rule.weekday} onChange={e=>setRules(list=>list.map((r,j)=>j===i?{...r,weekday:Number(e.target.value)}:r))}>
            {weekdays.map((day,d)=><option value={d+1} key={day}>{day}</option>)}
          </select>
          <Input className="w-28" aria-label="Начало" type="time" value={clock(rule.startMinutes)}
            onChange={e=>setRules(list=>list.map((r,j)=>j===i?{...r,startMinutes:minute(e.target.value)}:r))}/>
          <Input className="w-28" aria-label="Конец" type="time" value={clock(rule.endMinutes)}
            onChange={e=>setRules(list=>list.map((r,j)=>j===i?{...r,endMinutes:minute(e.target.value)}:r))}/>
          <Button type="button" size="sm" variant="ghost" onClick={()=>setRules(list=>list.filter((_,j)=>j!==i))}>Удалить</Button>
        </div>)}
        <Button type="button" variant="outline" size="sm" onClick={()=>setRules(list=>[...list,{weekday:1,startMinutes:600,endMinutes:1200}])}>+ Интервал</Button>
        <p className="text-sm font-medium">Закрытые даты</p>
        {exceptions.filter(e=>e.kind==="CLOSED"&&e.startMinutes===null).map(e=><div key={e.date} className="flex items-center gap-2 text-sm">
          <span>{e.date}</span><Button type="button" size="sm" variant="ghost" onClick={()=>setExceptions(list=>list.filter(x=>x!==e))}>Удалить</Button>
        </div>)}
        <div className="flex items-center gap-2"><Input aria-label="Закрытая дата" className="max-w-44" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
          <Button type="button" size="sm" variant="outline" onClick={()=>{if(date&&!exceptions.some(e=>e.date===date)){setExceptions(list=>[...list,{date,kind:"CLOSED",startMinutes:null,endMinutes:null}]);setDate("");}}}>+ Закрыть день</Button>
        </div>
        {exceptions.some(e=>e.kind!=="CLOSED"||e.startMinutes!==null)&&<p className="text-xs text-muted-foreground">Особые интервалы сохранены без изменений.</p>}
        {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
        {message&&<p role="status" className="text-sm">{message}</p>}
        <Button type="button" disabled={busy} onClick={()=>void save()}>{busy?"Сохранение…":"Сохранить расписание"}</Button>
        <p className="text-xs text-muted-foreground">При будущих бронированиях изменение ресурса запрещено сервером. Конфликт вернёт ошибку.</p>
      </>}
    </section>
  );
}
