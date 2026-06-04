"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useNotificationStore } from "@/features/notifications/store";
import { NotificationActionsBar } from "./NotificationActionsBar";
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
  const initialPageTab = useMemo(
    () => parsePageTab(searchParams.get("tab")),
    [searchParams],
  );
  const [activePageTab, setActivePageTab] = useState<NotificationPageTabValue>(initialPageTab);

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
  );
}
