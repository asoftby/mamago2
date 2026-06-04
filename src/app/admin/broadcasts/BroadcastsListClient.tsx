"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "@/lib/toast";
import type { AdminBroadcast } from "@prisma/client";

const TYPE_LABELS: Record<string, string> = {
  NEWS: "Новость",
  ANNOUNCEMENT: "Объявление",
  SYSTEM: "Системное",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Низкий",
  NORMAL: "Обычный",
  HIGH: "Высокий",
  CRITICAL: "Критический",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  SCHEDULED: "Запланировано",
  PUBLISHED: "Опубликовано",
  ARCHIVED: "Архив",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  PUBLISHED: "bg-green-100 text-green-700",
  ARCHIVED: "bg-yellow-100 text-yellow-700",
};

const AUDIENCE_LABELS: Record<string, string> = {
  BUSINESS: "Бизнес",
  USER: "Пользователи",
  ALL: "Все",
};

type BroadcastRow = AdminBroadcast & {
  createdBy: { id: string; email: string };
};

interface Props {
  initialItems: BroadcastRow[];
  total: number;
}

export function BroadcastsListClient({ initialItems, total }: Props) {
  const [items, setItems] = useState(initialItems);

  const handlePublish = async (id: string) => {
    if (!confirm("Опубликовать сообщение? Это действие нельзя отменить.")) return;
    try {
      const res = await fetch(`/api/admin/broadcasts/${id}/publish`, { method: "POST" });
      const data = await res.json() as { broadcast?: BroadcastRow; error?: string; notificationsCreated?: number };
      if (!res.ok) {
        toast.error(data.error ?? "Ошибка публикации");
        return;
      }
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...data.broadcast } : item)),
      );
      toast.success(`Опубликовано. Уведомлений создано: ${data.notificationsCreated ?? 0}`);
    } catch {
      toast.error("Ошибка сети");
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Архивировать сообщение?")) return;
    try {
      const res = await fetch(`/api/admin/broadcasts/${id}/archive`, { method: "POST" });
      const data = await res.json() as { broadcast?: BroadcastRow; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Ошибка архивирования");
        return;
      }
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...data.broadcast } : item)),
      );
      toast.success("Сообщение архивировано");
    } catch {
      toast.error("Ошибка сети");
    }
  };

  const handleUnschedule = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/broadcasts/${id}/unschedule`, { method: "POST" });
      const data = await res.json() as { broadcast?: BroadcastRow; error?: string };
      if (!res.ok || !data.broadcast) {
        toast.error(data.error ?? "Ошибка");
        return;
      }
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...data.broadcast } : item)),
      );
      toast.success("Сообщение возвращено в черновик");
    } catch {
      toast.error("Ошибка сети");
    }
  };

  const handleCreateCorrection = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/broadcasts/${id}/create-correction`, { method: "POST" });
      const data = await res.json() as { broadcast?: BroadcastRow; error?: string };
      if (!res.ok || !data.broadcast) {
        toast.error(data.error ?? "Ошибка");
        return;
      }
      window.location.href = `/admin/broadcasts/${data.broadcast.id}/edit`;
    } catch {
      toast.error("Ошибка сети");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Всего: <span className="font-medium">{total}</span>
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Заголовок</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Тип</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Аудитория</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Статус</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Приоритет</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Дата</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <Link
                      href={`/admin/broadcasts/${item.id}/edit`}
                      className="font-medium text-gray-900 hover:text-blue-600 line-clamp-1 max-w-xs"
                    >
                      {item.title}
                    </Link>
                    {item.summary && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.summary}</p>
                    )}
                    {item.publishedEditCount > 0 ? (
                      <p className="mt-1 text-[11px] text-gray-500">
                        Исправлено {item.publishedEditCount} раз
                      </p>
                    ) : null}
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    {TYPE_LABELS[item.type] ?? item.type}
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    {AUDIENCE_LABELS[item.audienceType] ?? item.audienceType}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-700">
                    {PRIORITY_LABELS[item.priority] ?? item.priority}
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {item.status === "SCHEDULED" && item.scheduledAt
                      ? `Публикация ${new Date(item.scheduledAt).toLocaleString("ru-RU")}`
                      : item.publishedAt
                      ? formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true, locale: ru })
                      : formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ru })}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/broadcasts/${item.id}/edit`}
                        className="text-blue-600 hover:text-blue-700 text-xs"
                      >
                        {item.status === "PUBLISHED" || item.status === "ARCHIVED" ? "Просмотр" : "Изменить"}
                      </Link>
                      {item.status === "DRAFT" ? (
                        <button
                          onClick={() => void handlePublish(item.id)}
                          className="text-green-600 hover:text-green-700 text-xs"
                        >
                          Опубликовать
                        </button>
                      ) : null}
                      {item.status === "SCHEDULED" ? (
                        <>
                          <button
                            onClick={() => void handlePublish(item.id)}
                            className="text-green-600 hover:text-green-700 text-xs"
                          >
                            Опубликовать сейчас
                          </button>
                          <button
                            onClick={() => void handleUnschedule(item.id)}
                            className="text-gray-500 hover:text-gray-700 text-xs"
                          >
                            В черновик
                          </button>
                        </>
                      ) : null}
                      {item.status === "PUBLISHED" ? (
                        <>
                          <Link
                            href={`/admin/broadcasts/${item.id}/edit`}
                            className="text-amber-700 hover:text-amber-800 text-xs"
                          >
                            Исправить
                          </Link>
                          <button
                            onClick={() => void handleCreateCorrection(item.id)}
                            className="text-gray-600 hover:text-gray-800 text-xs"
                          >
                            Создать исправление
                          </button>
                        </>
                      ) : null}
                      {item.status !== "ARCHIVED" ? (
                        <button
                          onClick={() => void handleArchive(item.id)}
                          className="text-gray-500 hover:text-gray-700 text-xs"
                        >
                          Архив
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {items.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            Сообщений пока нет.{" "}
            <Link href="/admin/broadcasts/new" className="text-blue-600 hover:underline">
              Создать первое
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
