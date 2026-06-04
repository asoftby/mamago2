"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type NotificationTabValue = "inbox" | "unread" | "archived";
export type NotificationPageTabValue = NotificationTabValue | "settings";

const TAB_LABELS: Record<NotificationPageTabValue, string> = {
  inbox: "Входящие",
  unread: "Непрочитанные",
  archived: "Архив",
  settings: "Настройки",
};

export function NotificationTabs({
  value,
  onValueChange,
  includeSettings = false,
}: {
  value: NotificationPageTabValue;
  onValueChange: (value: NotificationPageTabValue) => void;
  includeSettings?: boolean;
}) {
  const tabs = includeSettings
    ? (["inbox", "unread", "archived", "settings"] as const)
    : (["inbox", "unread", "archived"] as const);

  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(next as NotificationPageTabValue)}>
      <TabsList
        className={
          includeSettings
            ? "grid h-auto w-full grid-cols-2 rounded-xl bg-neutral-100 p-1 sm:grid-cols-4"
            : "grid h-auto w-full grid-cols-3 rounded-xl bg-neutral-100 p-1"
        }
      >
        {tabs.map((tab) => (
          <TabsTrigger key={tab} value={tab} className="rounded-lg">
            {TAB_LABELS[tab]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
