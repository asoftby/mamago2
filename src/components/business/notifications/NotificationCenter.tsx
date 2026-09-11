"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  fetchResolvedNotificationAction,
  type ResolvedNotificationAction,
} from "@/features/notifications/notification-click";
import { useNotificationStore } from "@/features/notifications/store";
import { toast } from "@/lib/toast";
import { NotificationActionsBar } from "./NotificationActionsBar";
import { NotificationDetailDialog } from "./NotificationDetailDialog";
import { NotificationFeed } from "./NotificationFeed";
import {
  NotificationTabs,
  type NotificationPageTabValue,
  type NotificationTabValue,
} from "./NotificationTabs";
import { NotificationSettingsPanel } from "./NotificationSettingsPanel";

function parsePageTab(raw: string | null): NotificationPageTabValue {
  if (raw === "unread" || raw === "archived" || raw === "settings") {
    return raw;
  }
  return "inbox";
}

export function NotificationCenter({
  stream,
  title = "Уведомления",
}: {
  stream: "user" | "business";
  title?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const items = useNotificationStore((s) => s.items);
  const setActiveStream = useNotificationStore((s) => s.setActiveStream);
  const setActiveTab = useNotificationStore((s) => s.setActiveTab);
  const activeTab = useNotificationStore((s) => s.activeTab);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const archiveAllRead = useNotificationStore((s) => s.archiveAllRead);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [detailAction, setDetailAction] = useState<ResolvedNotificationAction | null>(null);
  const initialPageTab = useMemo(
    () => parsePageTab(searchParams.get("tab")),
    [searchParams],
  );
  const [activePageTab, setActivePageTab] = useState<NotificationPageTabValue>(initialPageTab);
  const openNotificationId = searchParams.get("open");

  useEffect(() => {
    setActiveStream(stream);
  }, [setActiveStream, stream]);

  useEffect(() => {
    setActivePageTab(initialPageTab);
  }, [initialPageTab]);

  useEffect(() => {
    if (activePageTab === "settings") {
      return;
    }

    setActiveTab(activePageTab as NotificationTabValue);
  }, [activePageTab, setActiveTab]);

  useEffect(() => {
    if (!openNotificationId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const action = await fetchResolvedNotificationAction(openNotificationId);
        if (cancelled) return;

        useNotificationStore.getState().markAsRead(openNotificationId);
        if (stream === "business") {
          await useNotificationStore.getState().refreshBusinessUnreadOnly({ force: true });
        } else {
          await useNotificationStore.getState().refreshUnreadOnly({ force: true });
        }
        if (cancelled) return;

        if (action.actionMode === "MODAL") {
          setDetailAction(action);
          return;
        }

        if (action.actionMode === "EXTERNAL_URL" && action.actionUrl) {
          window.open(action.actionUrl, "_blank", "noopener,noreferrer");
        } else if (action.actionMode === "PAGE" && action.actionUrl) {
          router.replace(action.actionUrl);
          return;
        }

        const params = new URLSearchParams(searchParams.toString());
        params.delete("open");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      } catch (error) {
        console.error(error);
        toast.error("Не удалось открыть сообщение");
        const params = new URLSearchParams(searchParams.toString());
        params.delete("open");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openNotificationId, pathname, router, searchParams, stream]);

  const updateUrlTab = (nextTab: NotificationPageTabValue) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === "inbox") {
      params.delete("tab");
    } else {
      params.set("tab", nextTab);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const closeDetail = () => {
    setDetailAction(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("open");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handleMarkAllRead = async () => {
    setSubmittingAction(true);
    try {
      await markAllRead();
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleArchiveRead = async () => {
    setSubmittingAction(true);
    try {
      await archiveAllRead();
    } finally {
      setSubmittingAction(false);
    }
  };

  const handlePageTabChange = (nextTab: NotificationPageTabValue) => {
    setActivePageTab(nextTab);
    updateUrlTab(nextTab);
  };

  return (
    <>
      <section className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-neutral-950">{title}</h1>
          <p className="text-sm text-neutral-500">
            Последние события, новости и действия, которые требуют внимания.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="space-y-4 border-b border-neutral-200 px-4 py-4 sm:px-6">
            <NotificationTabs
              value={activePageTab}
              includeSettings={stream === "business"}
              onValueChange={handlePageTabChange}
            />
            {activePageTab !== "settings" ? (
              <NotificationActionsBar
                archived={activeTab === "archived"}
                hasNotifications={items.length > 0}
                isSubmitting={submittingAction}
                onMarkAllRead={handleMarkAllRead}
                onArchiveRead={handleArchiveRead}
              />
            ) : null}
          </div>

          {activePageTab === "settings" ? (
            <NotificationSettingsPanel surface={stream === "business" ? "BUSINESS" : "USER"} />
          ) : (
            <NotificationFeed open stream={stream} />
          )}
        </div>
      </section>

      <NotificationDetailDialog
        open={detailAction != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeDetail();
        }}
        title={detailAction?.modalTitle ?? null}
        body={detailAction?.modalBody ?? null}
      />
    </>
  );
}
