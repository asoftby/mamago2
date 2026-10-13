"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CalendarDays, Heart, MapPin, Plus, RefreshCw, Trash2, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { findWeekendConflicts, type WeekendData, type WeekendStop } from "./weekendRules";

const shortDate = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
const formatTime = (date: string | null) =>
  date ? new Date(date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Minsk" }) : null;
const dateLabel = (date: string) =>
  `${new Date(date + "T12:00:00Z").getUTCDay() === 6 ? "Суббота" : "Воскресенье"}, ${shortDate(date)}`;

async function readWeekend(city: string, date: string): Promise<WeekendData> {
  const response = await fetch(`/api/admin/weekend?city=${encodeURIComponent(city)}&date=${encodeURIComponent(date)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Не удалось загрузить подборку. Проверьте доступ и повторите.");
  return await response.json() as WeekendData;
}

function routeLink(stops: WeekendStop[]): string | null {
  const coords = stops.map(s => s.coords).filter((x): x is { lat: number; lng: number } => x != null);
  if (coords.length < 2) return null;
  const values = coords.map(p => `${p.lat},${p.lng}`);
  const params = new URLSearchParams({ api: "1", origin: values[0]!, destination: values[values.length - 1]!, travelmode: "driving" });
  if (values.length > 2) params.set("waypoints", values.slice(1, -1).join("|"));
  return "https://www.google.com/maps/dir/?" + params.toString();
}

function selectedStops(data: WeekendData, keys: string[]) {
  const byKey = new Map(data.candidates.map(c => [c.key, c]));
  return keys.map(key => byKey.get(key)).filter((point): point is WeekendStop => point != null)
    .sort((a,b) => (a.startsAt ?? "9999").localeCompare(b.startsAt ?? "9999"));
}

export function WeekendPlanner({ citySlug, cityName, initialDate }: { citySlug: string; cityName: string; initialDate: string }) {
  const [date, setDate] = useState(initialDate);
  const [data, setData] = useState<WeekendData | null>(null);
  const [keys, setKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());
  const [replaceKey, setReplaceKey] = useState<string | null>(null);
  const [acknowledgedConflicts, setAcknowledgedConflicts] = useState(false);

  const load = useCallback(async (day: string) => {
    setLoading(true); setError(""); setMessage(""); setReplaceKey(null); setAcknowledgedConflicts(false);
    try {
      const value = await readWeekend(citySlug, day);
      setData(value);
      setKeys(value.initialKeys);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка загрузки"); setData(null); }
    finally { setLoading(false); }
  }, [citySlug]);

  useEffect(() => { void load(date); }, [date, load]);

  // On Sunday the next weekend starts the following Saturday; keep a direct
  // toggle for the selected weekend when the user switches Saturday → Sunday.
  const saturday = useMemo(() => {
    const day = new Date(date + "T12:00:00Z").getUTCDay();
    const offset = day === 0 ? -1 : 0;
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0,10);
  }, [date]);
  const sunday = useMemo(() => {
    const d = new Date(saturday + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0,10);
  }, [saturday]);

  const stops = data ? selectedStops(data, keys) : [];
  const clashes = stops.flatMap(stop => findWeekendConflicts(stop, data?.existing ?? []).map(c => ({ key: stop.key, ...c })));
  const definite = clashes.filter(c => c.severity === "conflict");
  const hasWarnings = clashes.length > 0;
  const plannedKeys = new Set((data?.existing ?? []).flatMap(item => [
    ...(item.activityId ? ["activity:" + item.activityId] : []),
    ...(item.placeId ? ["place:" + item.placeId] : []),
  ]));
  const available = (data?.candidates ?? []).filter(point => !keys.includes(point.key));
  const placesRoute = routeLink(stops);

  const changeDate = (value: string) => {
    if (value !== date) {
      setDate(value);
      window.history.replaceState(null, "", `/${citySlug}/weekend?date=${value}`);
    }
  };

  async function saveIdea(stop: WeekendStop) {
    if (favoriteKeys.has(stop.key)) return;
    const response = await fetch("/api/save/idea", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stop.kind === "activity" ? { activityId: stop.id } : { placeId: stop.id }),
    });
    if (!response.ok) { setError("Не удалось сохранить в «Идеи»"); return; }
    setFavoriteKeys(previous => new Set(previous).add(stop.key));
    setMessage(`«${stop.title}» сохранено в «Идеи».`);
  }

  async function savePlan() {
    if (!data || !stops.length || saving) return;
    if (hasWarnings && !acknowledgedConflicts) { setError("Сначала подтвердите, что вы ознакомились с пересечениями."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      // Re-read just before saving: family plans may have changed on another device.
      const fresh = await readWeekend(citySlug, date);
      const previousPlanSnapshot = JSON.stringify(data.existing.map(({ id, startsAt, endsAt }) => ({ id, startsAt, endsAt })));
      const newPlanSnapshot = JSON.stringify(fresh.existing.map(({ id, startsAt, endsAt }) => ({ id, startsAt, endsAt })));
      if (previousPlanSnapshot !== newPlanSnapshot) {
        setData({ ...data, existing: fresh.existing });
        setAcknowledgedConflicts(false);
        setError("Семейное расписание изменилось. Проверьте пересечения и нажмите «Сохранить» ещё раз.");
        return;
      }
      const already = new Set(plannedKeys);
      let added = 0;
      for (const stop of stops) {
        if (already.has(stop.key)) continue;
        const body = stop.kind === "activity"
          ? { activityId: stop.id, activitySessionId: stop.sessionId, date, planAddSource: "recommendation" }
          : { placeId: stop.id, date };
        const response = await fetch("/api/save/plan", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          throw new Error(`Сохранено точек: ${added}. Не удалось добавить «${stop.title}». Остальные не изменены.`);
        }
        already.add(stop.key);
        added++;
      }
      const refreshed = await readWeekend(citySlug, date);
      setData({ ...data, existing: refreshed.existing });
      setMessage(added ? `Добавлено в «Мой план»: ${added}. Уже существующие записи не изменены.` : "Эти точки уже находятся в «Моём плане».");
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить маршрут"); }
    finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-[#f7faf9] pb-28 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        <Link href={`/${citySlug}/events`} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-800"><ArrowLeft size={16}/> Куда пойти</Link>
        <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Тестовый режим · только администратор</div>
            <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight sm:text-4xl">Ваш выходной в {cityName}</h1>
            <p className="mt-2 text-sm text-slate-600">Подбираем идеи для семьи — окончательный выбор за вами.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => changeDate(saturday)} aria-pressed={date===saturday} className={`rounded-2xl px-4 py-3 text-sm font-medium ${date===saturday ? "bg-emerald-700 text-white" : "border border-slate-200 bg-white"}`}>Суббота<br/><span className="text-xs">{shortDate(saturday)}</span></button>
            <button type="button" onClick={() => changeDate(sunday)} aria-pressed={date===sunday} className={`rounded-2xl px-4 py-3 text-sm font-medium ${date===sunday ? "bg-emerald-700 text-white" : "border border-slate-200 bg-white"}`}>Воскресенье<br/><span className="text-xs">{shortDate(sunday)}</span></button>
          </div>
        </div>

        {error && <div role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
        {message && <div role="status" className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{message}</div>}
        {loading && <p role="status" className="mt-10 text-slate-600">Подбираем реальные предложения на {dateLabel(date)}…</p>}

        {!loading && data && <>
          <section className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm"><span className="text-xs text-slate-500">Дети</span><p className="mt-1 font-medium">{data.childrenLabel}</p></div>
            <div className="rounded-2xl bg-white p-4 shadow-sm"><span className="text-xs text-slate-500">Интересы</span><p className="mt-1 font-medium">{data.interestLabels.join(", ") || "Пока не указаны"}</p></div>
            <div className="rounded-2xl bg-white p-4 shadow-sm"><span className="text-xs text-slate-500">В вашем плане</span><p className="mt-1 font-medium">{data.existing.length} записей на {dateLabel(date).toLowerCase()}</p></div>
          </section>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <p className="text-sm font-medium">{stops.length} подходящих точек · {definite.length} пересечений по известному времени{clashes.length > definite.length ? ` · ${clashes.length - definite.length} возможных` : ""}</p>
            <p className="mt-1 text-xs text-slate-600">Планы семьи показаны серым. Мы не скрываем интересные события из-за пересечений и ничего не переносим автоматически.</p>
          </div>

          <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_250px]">
            <div>
              <h2 className="mb-3 text-xl font-semibold">Маршрут на {dateLabel(date).toLowerCase()}</h2>
              <div className="space-y-3">
                {[...data.existing.map(p => ({ tag: "existing" as const, sort: p.startsAt ?? "9999", entry: p })), ...stops.map(p => ({ tag: "stop" as const, sort: p.startsAt ?? "9999", entry: p }))].sort((a,b)=>a.sort.localeCompare(b.sort)).map(row => row.tag === "existing" ? (
                  <article key={"existing:"+row.entry.id} className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-100 p-4 text-slate-700">
                    <Clock className="mt-1 shrink-0 text-slate-400" size={18}/>
                    <div><div className="text-xs font-medium uppercase text-slate-500">Уже в плане · {formatTime(row.entry.startsAt) ?? "время не указано"}</div><h3 className="mt-1 font-semibold">{row.entry.title}</h3><p className="mt-1 text-xs text-slate-500">Эта запись не редактируется в сценарии.</p></div>
                  </article>
                ) : (() => {
                  const stop = row.entry;
                  const warnings = findWeekendConflicts(stop, data.existing);
                  const planned = plannedKeys.has(stop.key);
                  return (
                    <article key={stop.key} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${warnings.length ? "border-amber-300" : "border-slate-100"}`}>
                      <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
                        {stop.imageUrl ? <Image unoptimized src={stop.imageUrl} alt="" width={128} height={128} className="h-28 w-24 shrink-0 rounded-xl object-cover sm:h-32 sm:w-32"/> : <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><MapPin size={24}/></div>}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <div className="text-xs font-medium text-emerald-700">{formatTime(stop.startsAt) ?? "Гибкое время"} · {stop.kind === "activity" ? "Событие" : "Место"}</div>
                            <button type="button" aria-label={favoriteKeys.has(stop.key) ? "Сохранено в Идеи" : "Сохранить в Идеи"} title="В Идеи" onClick={() => void saveIdea(stop)} className="rounded-full border border-slate-200 p-2 text-rose-500"><Heart size={17} fill={favoriteKeys.has(stop.key) ? "currentColor" : "none"}/></button>
                          </div>
                          <h3 className="mt-1 text-base font-semibold leading-snug">{stop.title}</h3>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{stop.description}</p>
                          <p className="mt-2 text-xs text-slate-500">{stop.address || stop.reason}</p>
                          {stop.rating != null && <span className="mt-1 inline-block text-xs text-slate-600">Оценка Google: {stop.rating.toFixed(1)}</span>}
                          {planned && <p className="mt-2 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14} className="mr-1 inline"/>Уже сохранено в «Мой план»</p>}
                        </div>
                      </div>
                      {warnings.length > 0 && <div role="status" className="mx-3 mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:mx-4">
                        <AlertTriangle size={14} className="mr-1 inline"/>
                        {warnings.map(w => `${w.severity === "conflict" ? "Пересечение" : "Возможное пересечение (длительность неизвестна)"}: ${w.planTitle}`).join("; ")}
                      </div>}
                      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-3 text-xs sm:px-4">
                        <Link href={stop.href} className="rounded-lg bg-slate-100 px-3 py-2 font-medium hover:bg-slate-200">Подробнее</Link>
                        <button type="button" onClick={() => setReplaceKey(replaceKey === stop.key ? null : stop.key)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 font-medium text-emerald-800"><RefreshCw size={13}/>Заменить</button>
                        <button type="button" onClick={() => {setKeys(old => old.filter(k => k !== stop.key)); setAcknowledgedConflicts(false); setReplaceKey(null);}} className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-2 font-medium text-rose-700"><Trash2 size={13}/>Убрать</button>
                      </div>
                      {replaceKey === stop.key && <div className="border-t border-slate-100 bg-emerald-50/50 px-4 py-3">
                        <p className="mb-2 text-xs font-semibold">Выберите другую точку</p>
                        {available.length ? available.slice(0, 8).map(option => <button type="button" key={option.key} onClick={() => { setKeys(old => old.map(key => key === stop.key ? option.key : key)); setReplaceKey(null); setAcknowledgedConflicts(false); }} className="mb-2 block w-full rounded-xl bg-white p-3 text-left text-sm shadow-sm"><span className="font-medium">{option.title}</span><span className="ml-2 text-xs text-slate-500">{formatTime(option.startsAt) ?? "Гибкое время"}</span></button>) : <p className="text-xs text-slate-500">Других подходящих мест пока нет.</p>}
                      </div>}
                    </article>
                  );
                })())}
              </div>

              <button type="button" disabled={!available.length} onClick={() => {setKeys(old => [...old, available[0]!.key]); setAcknowledgedConflicts(false);}} className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-emerald-600 bg-white px-5 py-3 text-sm font-semibold text-emerald-700 disabled:opacity-50"><Plus size={17}/>Добавить ещё точку</button>
              {!stops.length && <p className="mt-3 text-sm text-slate-500">Все точки убраны. Добавьте подходящую из предложенных вариантов.</p>}

              <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="font-semibold">Сохранение в «Мой план»</h3>
                <p className="mt-2 text-sm text-slate-600">Добавим только оставшиеся точки. Уже существующие записи останутся без изменений. Время для гибких мест не назначаем автоматически.</p>
                {hasWarnings && <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-slate-800"><input type="checkbox" checked={acknowledgedConflicts} onChange={e => setAcknowledgedConflicts(e.target.checked)} className="mt-1 accent-emerald-700"/>Я увидел(а) пересечения и хочу сохранить выбранные точки без изменения существующих планов.</label>}
                <button type="button" onClick={() => void savePlan()} disabled={saving || !stops.length || (hasWarnings && !acknowledgedConflicts)} className="mt-4 w-full rounded-xl bg-emerald-700 px-5 py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  <CalendarDays size={17} className="mr-2 inline"/>{saving ? "Сохраняем…" : "Сохранить выбранное в «Мой план»"}
                </button>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <h3 className="font-semibold">Ваш маршрут</h3>
                <p className="mt-2 text-sm text-slate-600">{stops.length} точек · {stops.filter(s => s.startsAt).length} с известным временем</p>
                {placesRoute ? <a href={placesRoute} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-700"><MapPin size={16}/>Открыть точки на карте</a> : <p className="mt-2 text-xs text-slate-500">Маршрут появится, если найдутся координаты хотя бы двух точек.</p>}
                <p className="mt-3 text-xs text-slate-500">Проверяйте часы работы, длительность мероприятий и время в пути перед поездкой.</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <h3 className="font-semibold text-emerald-950">Почему эти места?</h3>
                <p className="mt-2 text-sm text-emerald-900">Используем опубликованные события, предпочтения детей и сведения о местах. Пересечения показаны, но не скрывают рекомендации. Платное продвижение пока не влияет на подбор.</p>
              </div>
              <div className="rounded-2xl bg-white p-4 text-xs text-slate-500">
                <p>Админ-тест: {data.algorithmVersion}</p><p className="mt-1">Кандидатов: {data.candidateCount}</p>
              </div>
            </aside>
          </div>
        </>}
      </div>
    </main>
  );
}
