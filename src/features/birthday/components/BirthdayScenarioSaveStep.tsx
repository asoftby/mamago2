"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { SaveActivityHeader } from "@/components/activity/SaveActivityHeader";
import type { ActivityTicketSource } from "@/components/activity/ActivityTicketCard";
import { toast } from "@/lib/toast";

type Party = { id: string; childName: string | null; dateISO: string | null; status: string };

export function BirthdayScenarioSaveStep({ offerId, title, ticket, onBack, onClose }: {
  offerId: string; title: string; ticket?: ActivityTicketSource; onBack: () => void; onClose: () => void;
}) {
  const [parties, setParties] = React.useState<Party[]>([]);
  const [selected, setSelected] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [childName, setChildName] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loginRequired, setLoginRequired] = React.useState(false);
  const [savedPartyId, setSavedPartyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/parent/parties/saved-offers", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) { if (!controller.signal.aborted) setLoginRequired(true); return; }
        if (!response.ok) throw new Error("Не удалось загрузить праздники");
        const data = await response.json() as { parties?: Party[] };
        if (!controller.signal.aborted) {
          const choices = Array.isArray(data.parties) ? data.parties : [];
          setParties(choices);
          setCreating(choices.length === 0);
        }
      } catch {
        if (!controller.signal.aborted) setError("Не удалось загрузить праздники. Попробуйте ещё раз.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  async function save() {
    if (submitting || (!creating && !selected)) return;
    setSubmitting(true); setError(null);
    try {
      const response = await fetch("/api/parent/parties/saved-offers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creating ? { offerId, childName: childName.trim() || undefined } : { offerId, partyId: selected }),
      });
      const data = await response.json().catch(() => ({})) as { partyId?: string; error?: string };
      if (!response.ok || !data.partyId) {
        if (response.status === 401) setLoginRequired(true);
        throw new Error(data.error || "Не удалось сохранить предложение");
      }
      setSavedPartyId(data.partyId); toast.success("Добавлено в сценарий ДР");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось сохранить"); }
    finally { setSubmitting(false); }
  }

  return <div className="max-h-[85dvh] overflow-y-auto px-6 pb-6 pt-3 text-[#141210]" aria-label="Сохранить в сценарий дня рождения">
    <SaveActivityHeader heading="В сценарий ДР" ticket={ticket ?? { title }} kicker="сохранить предложение" />
    {savedPartyId ? <div role="status" className="space-y-4">
      <p className="flex items-center gap-2 text-[15px] font-semibold"><Check className="size-5 text-primary" /> Предложение сохранено</p>
      <p className="text-sm text-muted-foreground">Это идея для праздника, не бронирование. Заявка исполнителю не отправлена.</p>
      <Link className="flex min-h-12 items-center justify-center rounded-full bg-[#141210] px-4 text-sm font-semibold text-white"
        href={"/me/birthdays/" + encodeURIComponent(savedPartyId)}>Открыть сценарий</Link>
      <button type="button" className="min-h-11 w-full text-sm font-medium" onClick={onClose}>Продолжить просмотр</button>
    </div> : <>
      <button type="button" onClick={onBack} className="mb-4 flex min-h-10 items-center gap-2 text-[13px] font-medium text-[#706A65]">
        <ArrowLeft className="size-4" /> Назад
      </button>
      {loading && <p role="status" className="py-4 text-sm text-muted-foreground">Загружаем праздники…</p>}
      {loginRequired ? <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Войдите в аккаунт, чтобы сохранить предложение в сценарий.</p>
        <Link href="/login" className="inline-flex min-h-11 items-center rounded-full bg-[#141210] px-5 text-sm font-semibold text-white">Войти</Link>
      </div> : !loading ? <div className="space-y-3">
        {parties.length > 0 && <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Мои сценарии</p>
          {parties.map(party => <label key={party.id} className="flex min-h-[60px] cursor-pointer items-center gap-3 rounded-xl border border-[rgba(20,18,16,.15)] bg-white p-3">
            <input type="radio" name="birthday-scenario" className="size-4 accent-primary"
              checked={!creating && selected === party.id} onChange={() => { setSelected(party.id); setCreating(false); }} />
            <span className="min-w-0 flex-1 text-sm font-semibold">Праздник {party.childName || "ребёнка"}
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {party.dateISO ? new Date(party.dateISO + "T12:00:00Z").toLocaleDateString("ru-RU", {
                  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
                }) : "Дата не выбрана"}
              </span>
            </span>
          </label>)}
        </div>}
        <button type="button" onClick={() => { setCreating(true); setSelected(""); }}
          className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-[rgba(20,18,16,.15)] bg-[#FAF7F1] px-4 text-left text-sm font-semibold">
          <Plus className="size-4 text-primary" /> Создать новый сценарий
        </button>
        {creating && <div className="space-y-2">
          <label htmlFor="birthday-scenario-child" className="block text-xs font-medium">Для кого праздник? (необязательно)</label>
          <input id="birthday-scenario-child" value={childName} maxLength={120} onChange={event => setChildName(event.target.value)}
            placeholder="Имя ребёнка" className="h-11 w-full rounded-xl border border-[rgba(20,18,16,.2)] bg-white px-3 text-sm outline-none focus:border-primary" />
        </div>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="button" disabled={submitting || (!creating && !selected)} onClick={() => void save()}
          className="flex min-h-12 w-full items-center justify-center rounded-full bg-[#141210] px-5 text-sm font-semibold text-white disabled:opacity-40">
          {submitting ? "Сохраняем…" : "Сохранить в сценарий"}
        </button>
        <p className="text-xs leading-5 text-muted-foreground">Сохранение не создаёт заявку, бронь или обязательство оплаты.</p>
      </div> : null}
      {error && (loading || loginRequired) && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </>}
  </div>;
}
