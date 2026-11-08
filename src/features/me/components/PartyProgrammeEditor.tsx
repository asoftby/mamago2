"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BirthdayPartyDayPlan } from "./BirthdayPartyDayPlan";
import { BirthdayPartyShareModal } from "./BirthdayPartyShareModal";
import type { ProgrammeCommand, ProgrammeEntry, ProgrammeView } from "@/lib/birthday/partyProgramme";

export type ProgrammeEditorData = {
  id: string; version: number; cancelled: boolean; programme: ProgrammeView;
  entries: ProgrammeEntry[]; adultIds: string[]; childIds: string[]; inPlan: boolean;
  adults: Array<{ id: string; label: string }>; children: Array<{ id: string; label: string }>;
  publicPath: string | null; expiresAt: string | null;
};
export function PartyProgrammeEditor({ data }: { data: ProgrammeEditorData }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const titles = new Map(data.entries.map((entry, index) => [entry.itemId, data.programme.rows[index]?.title]));
  const [entries, setEntries] = useState(data.entries);
  const [adults, setAdults] = useState(data.adultIds);
  const [children, setChildren] = useState(data.childIds);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [days, setDays] = useState<1 | 7 | 30>(7);
  const save = async (command: ProgrammeCommand) => {
    if (pending) return;
    setPending(true); setError(null); setSaved(false);
    try {
      const response = await fetch(`/api/parent/parties/${encodeURIComponent(data.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || "Не удалось сохранить");
      }
      setSaved(true); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось сохранить"); }
    finally { setPending(false); }
  };
  const toggle = (values: string[], id: string) => values.includes(id) ? values.filter(value => value !== id) : [...values, id];
  const shareUrl = data.publicPath && typeof window !== "undefined" ? window.location.origin + data.publicPath : "";
  return <section className="space-y-6 border-t border-border pt-6">
    <BirthdayPartyDayPlan programme={data.programme} />
    {data.cancelled ? null : <fieldset disabled={!ready || pending} className="min-w-0 space-y-6">
      <details className="space-y-3"><summary className="min-h-11 cursor-pointer py-3 font-medium">Изменить время и порядок</summary>
        <p className="text-sm text-muted-foreground">Изменяется только программа. Для изменения забронированного времени обратитесь к исполнителю. Пустое время — по данным заказа.</p>
        {entries.map((entry, index) => <div key={entry.itemId} className="space-y-2 border-b border-border py-3">
          <p className="font-medium">{titles.get(entry.itemId) ?? "Услуга"}</p>
          <div className="flex flex-wrap gap-2">
            <label className="min-w-0 flex-1">Начало<Input className="min-h-11 text-base" type="time" value={entry.from ?? ""}
              onInput={event => { const value = event.currentTarget.value || null; setEntries(rows => rows.map(row => row.itemId === entry.itemId ? { ...row, from: value } : row)); }} /></label>
            <label className="min-w-0 flex-1">Окончание<Input className="min-h-11 text-base" type="time" value={entry.to ?? ""}
              onInput={event => { const value = event.currentTarget.value || null; setEntries(rows => rows.map(row => row.itemId === entry.itemId ? { ...row, to: value } : row)); }} /></label>
          </div>
          <div className="flex gap-2">{([-1, 1] as const).map(delta => <Button key={delta} className="min-h-11" variant="outline"
            disabled={pending || index + delta < 0 || index + delta >= entries.length}
            onClick={() => setEntries(rows => { const next = [...rows]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next; })}>
            {delta < 0 ? "Выше" : "Ниже"}</Button>)}</div>
        </div>)}
        <Button className="min-h-11" disabled={pending} onClick={() => void save({ action: "programme", version: data.version, entries })}>Сохранить программу</Button>
      </details>
      <details className="space-y-3"><summary className="min-h-11 cursor-pointer py-3 font-medium">Участники семьи</summary>
        <p className="text-sm text-muted-foreground">Выбранные взрослые увидят общую программу после сохранения в «Мой план». Личные задачи и условия заказа остаются закрытыми.</p>
        {data.adults.map(adult => <label className="flex min-h-11 items-center gap-3" key={adult.id}><input type="checkbox" checked={adults.includes(adult.id)} onChange={() => setAdults(values => toggle(values, adult.id))} />{adult.label}</label>)}
        {data.children.map(child => <label className="flex min-h-11 items-center gap-3" key={child.id}><input type="checkbox" checked={children.includes(child.id)} onChange={() => setChildren(values => toggle(values, child.id))} />{child.label} (профиль ребёнка)</label>)}
        <Button className="min-h-11" disabled={pending} onClick={() => void save({ action: "participants", version: data.version, adultIds: adults, childIds: children })}>Сохранить участников</Button>
      </details>
      <Button className="min-h-11" variant="outline" disabled={pending} onClick={() => void save({ action: "saveToPlan", version: data.version })}>{data.inPlan ? "Обновить в моём плане" : "Сохранить в мой план"}</Button>
      <details className="space-y-3"><summary className="min-h-11 cursor-pointer py-3 font-medium">Публичная ссылка</summary>
        <p className="text-sm text-muted-foreground">Любой, у кого есть ссылка, увидит только дату, категории услуг, время и статусы — как в программе выше. Имена, контакты, адреса и цены не раскрываются.</p>
        <label className="block">Срок доступа<select className="ml-2 min-h-11 rounded-md border border-border bg-background p-2 text-base" value={days} onChange={event => setDays(Number(event.target.value) as 1 | 7 | 30)}>
          <option value="1">1 день</option><option value="7">7 дней</option><option value="30">30 дней</option>
        </select></label>
        <div className="flex flex-wrap gap-2"><Button className="min-h-11" disabled={pending} onClick={() => void save({ action: "publicLink", version: data.version, days })}>{data.publicPath ? "Создать новую ссылку" : "Разрешить просмотр по ссылке"}</Button>
          {data.publicPath ? <Button className="min-h-11" variant="outline" disabled={pending} onClick={() => void save({ action: "publicLink", version: data.version, days: 0 })}>Отозвать ссылку</Button> : null}</div>
        {data.publicPath ? <div className="space-y-2"><p className="text-sm text-muted-foreground">Доступ до {data.expiresAt ? new Date(data.expiresAt).toLocaleString("ru-RU") : "—"}</p>
          <a href={data.publicPath} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">Предпросмотр для гостей</a>
          <Button className="min-h-11" variant="outline" onClick={() => setShareOpen(true)}>Поделиться ссылкой</Button></div> : null}
      </details>
    </fieldset>}
    {error ? <p role="alert" className="text-danger">{error} <Button className="min-h-11" variant="outline" onClick={() => router.refresh()}>Обновить</Button></p> : null}
    {saved ? <p role="status" className="text-sm text-muted-foreground">Сохранено</p> : null}
    {pending ? <p role="status">Сохраняем…</p> : null}
    <BirthdayPartyShareModal open={shareOpen} onOpenChange={setShareOpen} shareTitle="Программа праздника" shareFullText={`Программа праздника\n${shareUrl}`} shareUrl={shareUrl} />
  </section>;
}
