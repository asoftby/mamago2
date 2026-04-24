"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import type { AdminBroadcast } from "@prisma/client";

interface Props {
  mode: "create" | "edit";
  broadcast?: AdminBroadcast;
}

const TYPE_OPTIONS = [
  { value: "NEWS", label: "Новость" },
  { value: "ANNOUNCEMENT", label: "Объявление" },
  { value: "SYSTEM", label: "Системное" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Низкий" },
  { value: "NORMAL", label: "Обычный" },
  { value: "HIGH", label: "Высокий" },
  { value: "CRITICAL", label: "Критический" },
];

const AUDIENCE_OPTIONS = [
  { value: "BUSINESS", label: "Бизнес-партнёры" },
  { value: "USER", label: "Пользователи" },
  { value: "ALL", label: "Все" },
];

export function BroadcastForm({ mode, broadcast }: Props) {
  const router = useRouter();
  const isPublished = broadcast?.status === "PUBLISHED";
  const isArchived = broadcast?.status === "ARCHIVED";
  const isReadOnly = isPublished || isArchived;

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [form, setForm] = useState({
    title: broadcast?.title ?? "",
    summary: broadcast?.summary ?? "",
    body: broadcast?.body ?? "",
    type: broadcast?.type ?? "NEWS",
    priority: broadcast?.priority ?? "NORMAL",
    audienceType: broadcast?.audienceType ?? "BUSINESS",
    ctaLabel: broadcast?.ctaLabel ?? "",
    ctaUrl: broadcast?.ctaUrl ?? "",
    showInInbox: broadcast?.showInInbox ?? true,
    sendEmail: broadcast?.sendEmail ?? false,
    pinToDashboard: broadcast?.pinToDashboard ?? false,
  });

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Заполните заголовок и текст сообщения");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        summary: form.summary || null,
        ctaLabel: form.ctaLabel || null,
        ctaUrl: form.ctaUrl || null,
      };

      if (mode === "create") {
        const res = await fetch("/api/admin/broadcasts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json() as { broadcast?: { id: string }; error?: string };
        if (!res.ok) { toast.error(data.error ?? "Ошибка сохранения"); return; }
        toast.success("Черновик сохранён");
        router.push(`/admin/broadcasts/${data.broadcast!.id}/edit`);
      } else {
        const res = await fetch(`/api/admin/broadcasts/${broadcast!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json() as { error?: string };
        if (!res.ok) { toast.error(data.error ?? "Ошибка сохранения"); return; }
        toast.success("Сохранено");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!broadcast?.id) { await handleSave(); return; }
    if (!confirm("Опубликовать? Это действие нельзя отменить.")) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/admin/broadcasts/${broadcast.id}/publish`, { method: "POST" });
      const data = await res.json() as { error?: string; notificationsCreated?: number };
      if (!res.ok) { toast.error(data.error ?? "Ошибка публикации"); return; }
      toast.success(`Опубликовано. Уведомлений создано: ${data.notificationsCreated ?? 0}`);
      router.refresh();
    } finally {
      setPublishing(false);
    }
  };

  const handleArchive = async () => {
    if (!broadcast?.id) return;
    if (!confirm("Архивировать сообщение?")) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/admin/broadcasts/${broadcast.id}/archive`, { method: "POST" });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? "Ошибка"); return; }
      toast.success("Архивировано");
      router.push("/admin/broadcasts");
    } finally {
      setArchiving(false);
    }
  };

  const fieldClass = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:bg-gray-50 disabled:text-gray-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="max-w-2xl space-y-6">
      {isPublished && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          ✅ Сообщение опубликовано{broadcast.publishedAt ? ` · ${new Date(broadcast.publishedAt).toLocaleString("ru-RU")}` : ""}
        </div>
      )}
      {isArchived && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
          📦 Сообщение в архиве
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
        <div>
          <label className={labelClass}>Заголовок *</label>
          <input
            className={fieldClass}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Заголовок сообщения"
            maxLength={200}
            disabled={isReadOnly}
          />
        </div>

        <div>
          <label className={labelClass}>Краткое описание</label>
          <input
            className={fieldClass}
            value={form.summary}
            onChange={(e) => set("summary", e.target.value)}
            placeholder="Краткое описание (необязательно)"
            maxLength={500}
            disabled={isReadOnly}
          />
        </div>

        <div>
          <label className={labelClass}>Текст сообщения *</label>
          <textarea
            className={`${fieldClass} min-h-[120px] resize-y`}
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
            placeholder="Полный текст сообщения"
            disabled={isReadOnly}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Тип</label>
            <select
              className={fieldClass}
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
              disabled={isReadOnly}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Приоритет</label>
            <select
              className={fieldClass}
              value={form.priority}
              onChange={(e) => set("priority", e.target.value)}
              disabled={isReadOnly}
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Аудитория</label>
            <select
              className={fieldClass}
              value={form.audienceType}
              onChange={(e) => set("audienceType", e.target.value)}
              disabled={isReadOnly}
            >
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Текст кнопки (CTA)</label>
            <input
              className={fieldClass}
              value={form.ctaLabel}
              onChange={(e) => set("ctaLabel", e.target.value)}
              placeholder="Например: Подробнее"
              maxLength={100}
              disabled={isReadOnly}
            />
          </div>
          <div>
            <label className={labelClass}>Ссылка кнопки</label>
            <input
              className={fieldClass}
              value={form.ctaUrl}
              onChange={(e) => set("ctaUrl", e.target.value)}
              placeholder="https://..."
              disabled={isReadOnly}
            />
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.showInInbox}
              onChange={(e) => set("showInInbox", e.target.checked)}
              disabled={isReadOnly}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Показать во входящих</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.sendEmail}
              onChange={(e) => set("sendEmail", e.target.checked)}
              disabled
              className="h-4 w-4 rounded border-gray-300 opacity-50"
            />
            <span className="text-sm text-gray-500">
              Отправить email{" "}
              <span className="text-xs text-gray-400">(будет подключено позже)</span>
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.pinToDashboard}
              onChange={(e) => set("pinToDashboard", e.target.checked)}
              disabled={isReadOnly}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Закрепить в дашборде</span>
          </label>
        </div>
      </div>

      {!isReadOnly && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {saving ? "Сохранение…" : "Сохранить черновик"}
          </button>
          <button
            onClick={() => void handlePublish()}
            disabled={publishing}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {publishing ? "Публикация…" : "Опубликовать"}
          </button>
          {mode === "edit" && (
            <button
              onClick={() => void handleArchive()}
              disabled={archiving}
              className="ml-auto rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {archiving ? "…" : "Архивировать"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
