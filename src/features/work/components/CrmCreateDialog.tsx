"use client";

import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import type { CrmLead, WorkKind } from "../workDashboardModel";
import { minskDateInput, minskInputToIso } from "../workDashboardModel";

type FormMode = "task" | "lead";

interface Props {
  onClose: () => void;
  onSaved: () => void;
  leads: CrmLead[];
  defaultMode?: FormMode;
  defaultLeadId?: string;
}

const fieldClass = "w-full min-h-11 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export function CrmCreateDialog({
  onClose, onSaved, leads, defaultMode = "task", defaultLeadId = "",
}: Props) {
  const [mode, setMode] = useState<FormMode>(defaultMode);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<WorkKind>("OPERATIONS");
  const [due, setDue] = useState(() => minskDateInput());
  const [leadId, setLeadId] = useState(defaultLeadId);
  const [nextAction, setNextAction] = useState("");
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("TELEGRAM");
  // Stable idempotency key across retries of the same form submission.
  const [requestKey] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    let url: string;
    let data: Record<string, unknown>;
    if (mode === "task") {
      const dueAt = minskInputToIso(due);
      if (!dueAt) {
        setError("Укажите корректные дату и время.");
        return;
      }
      url = "/api/admin/work/items";
      data = {
        title: title.trim(), kind, dueAt,
        nextAction: nextAction.trim() || null,
        ...(leadId ? { leadId } : {}),
        createRequestKey: requestKey,
      };
    } else {
      url = "/api/admin/work/leads";
      data = {
        name: name.trim(),
        ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
        ...(phone.trim() ? { phoneE164: phone.trim() } : {}),
        source,
        createRequestKey: requestKey,
      };
    }
    setSaving(true);
    try {
      const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const payload: { message?: string; issues?: Array<{ message: string }> } =
          await response.json().catch(() => ({}));
        throw new Error(payload.issues?.[0]?.message || payload.message || "Не удалось сохранить запись");
      }
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-950/40 px-4 py-6"
      onKeyDown={event => { if (event.key === "Escape" && !saving) onClose(); }}
    >
      <div className="absolute inset-0" onClick={() => !saving && onClose()} aria-hidden="true" />
      <section
        role="dialog" aria-modal="true" aria-labelledby="crm-create-title"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="crm-create-title" className="text-xl font-semibold tracking-tight text-gray-950">
            {mode === "task" ? "Новое дело" : "Новый лид"}
          </h2>
          <button type="button" aria-label="Закрыть" onClick={onClose} disabled={saving}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-emerald-500">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
          {([{ id: "task", label: "Дело" }, { id: "lead", label: "Лид" }] as const).map(tab => (
            <button key={tab.id} type="button" onClick={() => { setMode(tab.id); setError(null); }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${mode === tab.id ? "bg-white text-gray-950 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "task" ? (
            <>
              <label className="block space-y-1.5 text-sm font-medium text-gray-800">
                Что нужно сделать?
                <input autoFocus required minLength={1} maxLength={240} value={title}
                  onChange={event => setTitle(event.target.value)} className={fieldClass}
                  placeholder="Например, позвонить батутному центру" />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5 text-sm font-medium text-gray-800">
                  Тип
                  <select value={kind} onChange={event => setKind(event.target.value as WorkKind)}
                    className={fieldClass}>
                    <option value="OPERATIONS">Обычное дело</option>
                    <option value="SALES">Продажа</option>
                    <option value="SERVICE">Сервис</option>
                  </select>
                </label>
                <label className="block space-y-1.5 text-sm font-medium text-gray-800">
                  Когда (Минск)
                  <input required type="datetime-local" value={due} onChange={event => setDue(event.target.value)}
                    className={fieldClass} />
                </label>
              </div>
              <label className="block space-y-1.5 text-sm font-medium text-gray-800">
                Связанный лид <span className="font-normal text-gray-400">· необязательно</span>
                <select value={leadId} onChange={event => setLeadId(event.target.value)}
                  className={fieldClass}>
                  <option value="">Без привязки</option>
                  {leads.filter(item => !item.businessId).map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5 text-sm font-medium text-gray-800">
                Следующий шаг <span className="font-normal text-gray-400">· необязательно</span>
                <input maxLength={1000} value={nextAction} onChange={event => setNextAction(event.target.value)}
                  className={fieldClass} placeholder="Например, отправить презентацию" />
              </label>
            </>
          ) : (
            <>
              <label className="block space-y-1.5 text-sm font-medium text-gray-800">
                Название бизнеса
                <input autoFocus required minLength={2} maxLength={200} value={name}
                  onChange={event => setName(event.target.value)} className={fieldClass}
                  placeholder="Например, Батутный центр" />
              </label>
              <label className="block space-y-1.5 text-sm font-medium text-gray-800">
                Контактное лицо <span className="font-normal text-gray-400">· необязательно</span>
                <input value={contactName} maxLength={200} onChange={event => setContactName(event.target.value)}
                  className={fieldClass} placeholder="Имя представителя" />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5 text-sm font-medium text-gray-800">
                  Телефон <span className="font-normal text-gray-400">· необязательно</span>
                  <input type="tel" value={phone} onChange={event => setPhone(event.target.value)}
                    className={fieldClass} placeholder="+375291234567" />
                </label>
                <label className="block space-y-1.5 text-sm font-medium text-gray-800">
                  Источник
                  <select value={source} onChange={event => setSource(event.target.value)} className={fieldClass}>
                    <option value="TELEGRAM">Telegram</option>
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="WEBSITE">Сайт</option>
                    <option value="REFERRAL">Рекомендация</option>
                    <option value="OTHER">Другое</option>
                  </select>
                </label>
              </div>
            </>
          )}
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100">
              Отмена
            </button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              <Plus className="h-4 w-4" />
              {saving ? "Сохраняем…" : mode === "task" ? "Создать дело" : "Добавить лид"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
