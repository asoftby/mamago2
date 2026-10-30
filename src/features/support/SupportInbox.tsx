"use client";
import { useCallback, useEffect, useState } from "react";

type Thread = { id: string; businessId: string; subject: string; status: "NEW" | "IN_PROGRESS" | "CLOSED"; lastMessageAt: string };
type Message = { id: string; body: string; actor: "BUSINESS" | "STAFF"; createdAt: string };

export function SupportInbox({ businessId, staff = false }: { businessId?: string; staff?: boolean }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [subject, setSubject] = useState("");
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadThreads = useCallback(async () => {
    const qs = businessId ? "?businessId=" + encodeURIComponent(businessId) : "";
    const response = await fetch("/api/support/threads" + qs, { cache: "no-store" });
    if (!response.ok) throw new Error("Не удалось загрузить обращения");
    const data: { threads: Thread[] } = await response.json();
    setThreads(data.threads);
  }, [businessId]);

  const loadMessages = useCallback(async (id: string) => {
    const response = await fetch("/api/support/threads/" + encodeURIComponent(id), { cache: "no-store" });
    if (!response.ok) throw new Error("Не удалось загрузить переписку");
    const data: { messages: Message[] } = await response.json();
    setMessages(data.messages);
  }, []);

  useEffect(() => { void loadThreads().catch(e => setError(String(e))); }, [loadThreads]);
  useEffect(() => {
    if (!selected) return;
    void loadMessages(selected).catch(e => setError(String(e)));
  }, [selected, loadMessages]);

  async function post(url: string, payload: object, after: () => void) {
    setBusy(true); setError("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error("Не удалось отправить сообщение");
      const value: { id?: string } = await response.json();
      after();
      await loadThreads();
      if (value.id && url === "/api/support/threads") setSelected(value.id);
      else if (selected) await loadMessages(selected);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка"); }
    finally { setBusy(false); }
  }

  const active = threads.find(t => t.id === selected);
  return <section className="mx-auto max-w-5xl space-y-5 px-4 py-8">
    <header><h1 className="text-2xl font-semibold">Поддержка mamaGo</h1>
      <p className="mt-1 text-sm text-stone-500">Обращения в поддержку отдельно от переписки с клиентами.</p></header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {!staff && businessId && <form className="space-y-3 rounded-xl border p-4" onSubmit={e => { e.preventDefault(); void post("/api/support/threads", { businessId, subject, body: draft }, () => { setSubject(""); setDraft(""); }); }}>
      <h2 className="font-semibold">Новое обращение</h2>
      <input required minLength={3} maxLength={160} className="w-full rounded-lg border p-3" placeholder="Тема обращения" value={subject} onChange={e => setSubject(e.target.value)}/>
      <textarea required maxLength={3000} className="w-full rounded-lg border p-3" placeholder="Опишите вопрос" value={draft} onChange={e => setDraft(e.target.value)}/>
      <button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">Отправить обращение</button>
    </form>}
    <div className="grid gap-4 md:grid-cols-[minmax(210px,1fr)_2fr]">
      <div className="space-y-2"><h2 className="font-semibold">Обращения</h2>
        {threads.map(t => <button key={t.id} onClick={() => setSelected(t.id)} className={"block w-full rounded-lg border p-3 text-left text-sm " + (selected === t.id ? "border-primary" : "")}>
          <span className="block font-medium">{t.subject}</span>
          <span className="text-stone-500">{t.status}{staff ? " · " + t.businessId : ""}</span>
        </button>)}
        {!threads.length && <p className="text-sm text-stone-500">Пока нет обращений</p>}
      </div>
      <div className="space-y-3 rounded-xl border p-4">
        {active ? <>
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{active.subject}</h2>
            {staff ? <select aria-label="Статус обращения" className="rounded-lg border p-2" value={active.status} onChange={async e => {
              const status = e.target.value; setError("");
              try { const response = await fetch("/api/support/threads/" + encodeURIComponent(active.id) + "/status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
                if (!response.ok) throw new Error("Не удалось изменить статус");
                await loadThreads();
              } catch (err) { setError(String(err)); }
            }}><option value="NEW">Новое</option><option value="IN_PROGRESS">В работе</option><option value="CLOSED">Закрыто</option></select> :
              <span className="text-sm text-stone-500">{active.status}</span>}
          </div>
          <div className="max-h-[420px] space-y-3 overflow-y-auto" aria-live="polite">
            {messages.map(m => <div key={m.id} className="rounded-lg bg-stone-50 p-3 text-sm">
              <p className="mb-1 font-medium">{m.actor === "STAFF" ? "Команда mamaGo" : "Представитель бизнеса"}</p>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>)}
          </div>
          {active.status !== "CLOSED" && <form onSubmit={e => { e.preventDefault(); void post("/api/support/threads/" + encodeURIComponent(active.id) + "/messages", { body: reply }, () => setReply("")); }} className="space-y-2">
            <textarea required maxLength={3000} value={reply} onChange={e => setReply(e.target.value)} className="w-full rounded-lg border p-3" placeholder="Ваш ответ"/>
            <button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">Отправить ответ</button>
          </form>}
        </> : <p className="text-sm text-stone-500">Выберите обращение</p>}
      </div>
    </div>
  </section>;
}
