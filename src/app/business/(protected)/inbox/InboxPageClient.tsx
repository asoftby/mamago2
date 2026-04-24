"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/auth/client";
import type { NotificationApiRow } from "@/lib/notifications/types";
import { getNotificationHref } from "@/lib/notifications/routing";

const TYPE_LABELS: Record<string, string> = {
  NEWS: "Новость",
  ANNOUNCEMENT: "Объявление",
  SYSTEM: "Системное",
  PLACE_APPROVED: "Модерация",
  PLACE_NEEDS_CHANGES: "Модерация",
  PLACE_REJECTED: "Модерация",
  PLACE_UPDATE_APPROVED: "Модерация",
  PLACE_UPDATE_NEEDS_REVISION: "Модерация",
  PLACE_UPDATE_REJECTED: "Модерация",
  ACTIVITY_APPROVED: "Модерация",
  ACTIVITY_NEEDS_CHANGES: "Модерация",
  ACTIVITY_REJECTED: "Модерация",
  OFFER_APPROVED: "Модерация",
  OFFER_NEEDS_CHANGES: "Модерация",
  OFFER_REJECTED: "Модерация",
  BUSINESS_VERIFIED: "Верификация",
  BUSINESS_REJECTED: "Верификация",
  BUSINESS_NEEDS_INFO: "Верификация",
};

const TYPE_ICONS: Record<string, string> = {
  NEWS: "📰",
  ANNOUNCEMENT: "📣",
  SYSTEM: "⚙️",
  PLACE_APPROVED: "✅",
  PLACE_NEEDS_CHANGES: "⚠️",
  PLACE_REJECTED: "❌",
  PLACE_UPDATE_APPROVED: "✅",
  PLACE_UPDATE_NEEDS_REVISION: "⚠️",
  PLACE_UPDATE_REJECTED: "❌",
  ACTIVITY_APPROVED: "✅",
  ACTIVITY_NEEDS_CHANGES: "⚠️",
  ACTIVITY_REJECTED: "❌",
  OFFER_APPROVED: "✅",
  OFFER_NEEDS_CHANGES: "⚠️",
  OFFER_REJECTED: "❌",
  BUSINESS_VERIFIED: "🎉",
  BUSINESS_REJECTED: "❌",
  BUSINESS_NEEDS_INFO: "ℹ️",
  WELCOME: "🎉",
};

type Tab = "all" | "news" | "important";

const NEWS_TYPES = ["NEWS", "ANNOUNCEMENT"];
const IMPORTANT_TYPES = ["SYSTEM", "BUSINESS_VERIFIED", "BUSINESS_REJECTED", "BUSINESS_NEEDS_INFO"];

function filterByTab(items: NotificationApiRow[], tab: Tab): NotificationApiRow[] {
  if (tab === "news") return items.filter((n) => NEWS_TYPES.includes(n.type));
  if (tab === "important") return items.filter((n) => IMPORTANT_TYPES.includes(n.type));
  return items;
}

const PAGE_SIZE = 20;

export function InboxPageClient() {
  const [notifications, setNotifications] = useState<NotificationApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [tab, setTab] = useState<Tab>("all");
  const [markingAll, setMarkingAll] = useState(false);

  const fetchPage = useCallback(async (startOffset: number, append: boolean) => {
    const params = new URLSearchParams({
      stream: "business",
      limit: String(PAGE_SIZE),
      offset: String(startOffset),
    });
    const res = await fetch(`/api/notifications?${params}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch");
    const data = await res.json() as { notifications: NotificationApiRow[]; hasMore?: boolean };
    const rows = data.notifications ?? [];
    if (append) {
      setNotifications((prev) => [...prev, ...rows]);
    } else {
      setNotifications(rows);
    }
    setHasMore(Boolean(data.hasMore));
    setOffset(startOffset + rows.length);
  }, []);

  const markOpen = useCallback(async () => {
    await fetch("/api/notifications/mark-open?stream=business", {
      method: "POST",
      credentials: "include",
    });
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPage(0, false), markOpen()])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [fetchPage, markOpen]);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) { toast.error("Ошибка"); return; }
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, seenAt: new Date().toISOString() })));
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
      toast.success("Все отмечены прочитанными");
    } finally {
      setMarkingAll(false);
    }
  };

  const loadMore = async () => {
    try {
      await fetchPage(offset, true);
    } catch {
      toast.error("Ошибка загрузки");
    }
  };

  const displayed = filterByTab(notifications, tab);
  const unreadCount = notifications.filter((n) => !n.seenAt).length;

  if (loading) {
    return <div className="py-12 text-center text-sm text-stone-500">Загрузка…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1">
          {(["all", "news", "important"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t
                  ? "bg-stone-900 text-white"
                  : "text-stone-600 hover:bg-stone-100",
              )}
            >
              {t === "all" ? "Все" : t === "news" ? "Новости" : "Важное"}
            </button>
          ))}
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleMarkAllRead()}
            disabled={markingAll}
            className="gap-2 rounded-xl"
          >
            <CheckCheck className="h-4 w-4" />
            Отметить всё прочитанным
          </Button>
        )}
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white py-16 text-center">
          <Bell className="mb-3 h-10 w-10 text-stone-200" />
          <p className="text-sm text-stone-500">Нет уведомлений в этой категории</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
          {displayed.map((n) => {
            const isNew = !n.seenAt;
            const href = getNotificationHref(n);
            const icon = TYPE_ICONS[n.type] ?? "📢";
            const typeLabel = TYPE_LABELS[n.type];

            const content = (
              <div className="flex gap-4 p-4 sm:p-5">
                <div className="flex-shrink-0 text-2xl leading-none mt-0.5">{icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {typeLabel && (
                        <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">
                          {typeLabel}
                        </span>
                      )}
                      {isNew && (
                        <span className="rounded-full bg-[#EF8759]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#C65D2E]">
                          Новое
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-stone-400">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ru })}
                    </span>
                  </div>
                  <p className={cn("text-sm text-stone-900", isNew ? "font-semibold" : "font-medium")}>
                    {n.title}
                  </p>
                  <p className="mt-1 text-sm text-stone-600 line-clamp-2">{n.body}</p>
                  {n.ctaLabel && n.ctaAction && (
                    <span className="mt-2 inline-block text-xs font-medium text-stone-700 underline">
                      {n.ctaLabel} →
                    </span>
                  )}
                </div>
              </div>
            );

            return (
              <div
                key={n.id}
                className={cn(
                  "transition-colors hover:bg-stone-50/60",
                  isNew && "border-l-[3px] border-[#EF8759] bg-[#FFF8F4]",
                )}
              >
                {href ? (
                  <Link href={href} className="block">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="text-center">
          <Button variant="outline" onClick={() => void loadMore()} className="rounded-xl">
            Загрузить ещё
          </Button>
        </div>
      )}
    </div>
  );
}
