"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "@/lib/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

const PUBLISHED_EDITABLE_FIELDS = new Set([
  "title",
  "summary",
  "body",
  "ctaLabel",
  "ctaUrl",
  "pinToDashboard",
]);

function toLocalDatetimeInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalDatetimeInputValue(value: string): string {
  return new Date(value).toISOString();
}

export function BroadcastForm({ mode, broadcast }: Props) {
  const router = useRouter();
  const status = broadcast?.status ?? "DRAFT";
  const isPublished = status === "PUBLISHED";
  const isArchived = status === "ARCHIVED";
  const isScheduled = status === "SCHEDULED";
  const isReadOnly = isArchived;

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [unscheduling, setUnscheduling] = useState(false);
  const [creatingCorrection, setCreatingCorrection] = useState(false);
  const [publishedEditEnabled, setPublishedEditEnabled] = useState(false);
  const [publishedEditDialogOpen, setPublishedEditDialogOpen] = useState(false);

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
    scheduledAt: toLocalDatetimeInputValue(broadcast?.scheduledAt),
  });
  const [publicationMode, setPublicationMode] = useState<"now" | "scheduled">(
    broadcast?.scheduledAt ? "scheduled" : "now",
  );

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const effectiveReadOnly = isReadOnly || (isPublished && !publishedEditEnabled);
  const publishedEditMeta = useMemo(() => {
    if (!broadcast?.publishedEditCount) return null;
    if (broadcast.lastEditedAfterPublishAt) {
      return `Исправлено ${broadcast.publishedEditCount} раз · последнее ${formatDistanceToNow(
        new Date(broadcast.lastEditedAfterPublishAt),
        { addSuffix: true, locale: ru },
      )}`;
    }
    return `Исправлено ${broadcast.publishedEditCount} раз`;
  }, [broadcast?.lastEditedAfterPublishAt, broadcast?.publishedEditCount]);

  const buildPayload = () => ({
    title: form.title,
    summary: form.summary || null,
    body: form.body,
    type: form.type,
    priority: form.priority,
    audienceType: form.audienceType,
    ctaLabel: form.ctaLabel || null,
    ctaUrl: form.ctaUrl || null,
    showInInbox: form.showInInbox,
    sendEmail: form.sendEmail,
    pinToDashboard: form.pinToDashboard,
  });

  const validateCoreFields = (): boolean => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Заполните заголовок и текст сообщения");
      return false;
    }
    if (publicationMode === "scheduled" && !form.scheduledAt) {
      toast.error("Укажите дату и время публикации");
      return false;
    }
    return true;
  };

  const persistDraft = async (): Promise<string | null> => {
    if (!validateCoreFields()) return null;

    const payload = buildPayload();

    if (mode === "create") {
      const res = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { broadcast?: { id: string }; error?: string };
      if (!res.ok || !data.broadcast?.id) {
        toast.error(data.error ?? "Ошибка сохранения");
        return null;
      }
      return data.broadcast.id;
    }

    const endpoint = isPublished
      ? `/api/admin/broadcasts/${broadcast!.id}/published-edit`
      : `/api/admin/broadcasts/${broadcast!.id}`;
    const responsePayload = isPublished
      ? {
          title: form.title,
          summary: form.summary || null,
          body: form.body,
          ctaLabel: form.ctaLabel || null,
          ctaUrl: form.ctaUrl || null,
          pinToDashboard: form.pinToDashboard,
        }
      : payload;

    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(responsePayload),
    });
    const data = await res.json() as {
      broadcast?: { id: string };
      error?: string;
      notificationsUpdated?: number;
    };
    if (!res.ok) {
      toast.error(data.error ?? "Ошибка сохранения");
      return null;
    }

    if (isPublished) {
      toast.success(
        `Исправление сохранено${typeof data.notificationsUpdated === "number" ? `. Обновлено уведомлений: ${data.notificationsUpdated}` : ""}`,
      );
    } else {
      toast.success(isScheduled ? "Изменения сохранены" : "Черновик сохранён");
    }

    return broadcast!.id;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const id = await persistDraft();
      if (!id) return;

      if (mode === "create") {
        router.push(`/admin/broadcasts/${id}/edit`);
        return;
      }

      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!validateCoreFields()) return;
    setPublishing(true);
    try {
      const id = mode === "create" ? await persistDraft() : broadcast?.id ?? null;
      if (!id) return;

      const res = await fetch(`/api/admin/broadcasts/${id}/publish`, { method: "POST" });
      const data = await res.json() as { error?: string; notificationsCreated?: number };
      if (!res.ok) {
        toast.error(data.error ?? "Ошибка публикации");
        return;
      }
      toast.success(`Опубликовано. Уведомлений создано: ${data.notificationsCreated ?? 0}`);
      if (mode === "create") {
        router.push(`/admin/broadcasts/${id}/edit`);
      } else {
        router.refresh();
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleSchedule = async () => {
    if (!validateCoreFields()) return;
    if (!form.scheduledAt) {
      toast.error("Укажите дату и время публикации");
      return;
    }

    setScheduling(true);
    try {
      const id = mode === "create" ? await persistDraft() : broadcast?.id ?? null;
      if (!id) return;

      const res = await fetch(`/api/admin/broadcasts/${id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: fromLocalDatetimeInputValue(form.scheduledAt) }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Ошибка планирования");
        return;
      }

      toast.success("Публикация запланирована");
      if (mode === "create") {
        router.push(`/admin/broadcasts/${id}/edit`);
      } else {
        router.refresh();
      }
    } finally {
      setScheduling(false);
    }
  };

  const handleUnschedule = async () => {
    if (!broadcast?.id) return;
    setUnscheduling(true);
    try {
      const res = await fetch(`/api/admin/broadcasts/${broadcast.id}/unschedule`, {
        method: "POST",
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Ошибка");
        return;
      }
      toast.success("Сообщение возвращено в черновик");
      router.refresh();
    } finally {
      setUnscheduling(false);
    }
  };

  const handleArchive = async () => {
    if (!broadcast?.id) return;
    if (!confirm("Архивировать сообщение?")) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/admin/broadcasts/${broadcast.id}/archive`, { method: "POST" });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Ошибка");
        return;
      }
      toast.success("Архивировано");
      router.push("/admin/broadcasts");
    } finally {
      setArchiving(false);
    }
  };

  const handleCreateCorrection = async () => {
    if (!broadcast?.id) return;
    setCreatingCorrection(true);
    try {
      const res = await fetch(`/api/admin/broadcasts/${broadcast.id}/create-correction`, {
        method: "POST",
      });
      const data = await res.json() as { broadcast?: { id: string }; error?: string };
      if (!res.ok || !data.broadcast?.id) {
        toast.error(data.error ?? "Не удалось создать исправление");
        return;
      }
      toast.success("Черновик исправления создан");
      router.push(`/admin/broadcasts/${data.broadcast.id}/edit`);
    } finally {
      setCreatingCorrection(false);
    }
  };

  const isFieldDisabled = (field: string): boolean => {
    if (isArchived) return true;
    if (!isPublished) return false;
    if (!publishedEditEnabled) return true;
    return !PUBLISHED_EDITABLE_FIELDS.has(field);
  };

  const fieldClass = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:bg-gray-50 disabled:text-gray-500";
  const labelClass = "mb-1 block text-sm font-medium text-gray-700";

  return (
    <div className="max-w-2xl space-y-6">
      {isPublished && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <div>
            Сообщение опубликовано
            {broadcast?.publishedAt
              ? ` · ${new Date(broadcast.publishedAt).toLocaleString("ru-RU")}`
              : ""}
          </div>
          {publishedEditMeta ? (
            <div className="mt-1 text-xs text-green-700/90">{publishedEditMeta}</div>
          ) : null}
        </div>
      )}
      {isScheduled && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Публикация запланирована
          {broadcast?.scheduledAt
            ? ` · ${new Date(broadcast.scheduledAt).toLocaleString("ru-RU", {
                timeZone: "Europe/Minsk",
              })}`
            : ""}
        </div>
      )}
      {isArchived && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Сообщение в архиве
        </div>
      )}

      <div className="space-y-5 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <label className={labelClass}>Заголовок *</label>
          <input
            className={fieldClass}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Заголовок сообщения"
            maxLength={200}
            disabled={isFieldDisabled("title")}
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
            disabled={isFieldDisabled("summary")}
          />
        </div>

        <div>
          <label className={labelClass}>Текст сообщения *</label>
          <textarea
            className={`${fieldClass} min-h-[140px] resize-y`}
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
            placeholder="Полный текст сообщения"
            disabled={isFieldDisabled("body")}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Тип</label>
            <select
              className={fieldClass}
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
              disabled={isFieldDisabled("type")}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Приоритет</label>
            <select
              className={fieldClass}
              value={form.priority}
              onChange={(e) => set("priority", e.target.value)}
              disabled={isFieldDisabled("priority")}
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Аудитория</label>
            <select
              className={fieldClass}
              value={form.audienceType}
              onChange={(e) => set("audienceType", e.target.value)}
              disabled={isFieldDisabled("audienceType")}
            >
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
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
              disabled={isFieldDisabled("ctaLabel")}
            />
          </div>
          <div>
            <label className={labelClass}>Ссылка кнопки</label>
            <input
              className={fieldClass}
              value={form.ctaUrl}
              onChange={(e) => set("ctaUrl", e.target.value)}
              placeholder="https://..."
              disabled={isFieldDisabled("ctaUrl")}
            />
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.showInInbox}
              onChange={(e) => set("showInInbox", e.target.checked)}
              disabled={isFieldDisabled("showInInbox")}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Показать во входящих</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
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
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.pinToDashboard}
              onChange={(e) => set("pinToDashboard", e.target.checked)}
              disabled={isFieldDisabled("pinToDashboard")}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Закрепить в дашборде</span>
          </label>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Публикация</p>
          <div className="mt-3 space-y-3">
            <label className="flex items-center gap-3 text-sm text-gray-700">
              <input
                type="radio"
                name="publicationMode"
                checked={publicationMode === "now"}
                onChange={() => setPublicationMode("now")}
                disabled={effectiveReadOnly}
              />
              <span>Опубликовать сейчас</span>
            </label>
            <label className="flex items-center gap-3 text-sm text-gray-700">
              <input
                type="radio"
                name="publicationMode"
                checked={publicationMode === "scheduled"}
                onChange={() => setPublicationMode("scheduled")}
                disabled={effectiveReadOnly}
              />
              <span>Запланировать публикацию</span>
            </label>
            {publicationMode === "scheduled" ? (
              <div className="space-y-2 pl-7">
                <input
                  type="datetime-local"
                  className={fieldClass}
                  value={form.scheduledAt}
                  onChange={(e) => set("scheduledAt", e.target.value)}
                  disabled={effectiveReadOnly}
                />
                <p className="text-xs text-gray-500">Время указано по Минску</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {!isArchived ? (
        <div className="flex flex-wrap items-center gap-3">
          {isPublished ? (
            <>
              {!publishedEditEnabled ? (
                <button
                  type="button"
                  onClick={() => setPublishedEditDialogOpen(true)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Исправить опубликованное
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                >
                  {saving ? "Сохранение…" : "Сохранить исправление"}
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleCreateCorrection()}
                disabled={creatingCorrection}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {creatingCorrection ? "Создание…" : "Создать исправление"}
              </button>
              <button
                type="button"
                onClick={() => void handleArchive()}
                disabled={archiving}
                className="ml-auto rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {archiving ? "…" : "Архивировать"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {saving
                  ? "Сохранение…"
                  : mode === "edit" && isScheduled
                    ? "Сохранить изменения"
                    : "Сохранить черновик"}
              </button>
              <button
                type="button"
                onClick={() => void handlePublish()}
                disabled={publishing}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                {publishing
                  ? "Публикация…"
                  : isScheduled
                    ? "Опубликовать сейчас"
                    : "Опубликовать сейчас"}
              </button>
              <button
                type="button"
                onClick={() => void handleSchedule()}
                disabled={scheduling}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {scheduling ? "Планирование…" : "Запланировать"}
              </button>
              {isScheduled ? (
                <button
                  type="button"
                  onClick={() => void handleUnschedule()}
                  disabled={unscheduling}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  {unscheduling ? "…" : "Вернуть в черновик"}
                </button>
              ) : null}
              {mode === "edit" ? (
                <button
                  type="button"
                  onClick={() => void handleArchive()}
                  disabled={archiving}
                  className="ml-auto rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  {archiving ? "…" : "Архивировать"}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <AlertDialog
        open={publishedEditDialogOpen}
        onOpenChange={setPublishedEditDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Исправить опубликованное сообщение?</AlertDialogTitle>
            <AlertDialogDescription>
              Сообщение уже опубликовано и могло быть прочитано пользователями.
              Исправление обновит текст в ленте уведомлений и в блоке
              «Что нового». Для существенных изменений лучше создать новое
              сообщение-исправление.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPublishedEditEnabled(true);
                setPublishedEditDialogOpen(false);
              }}
            >
              Продолжить исправление
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
