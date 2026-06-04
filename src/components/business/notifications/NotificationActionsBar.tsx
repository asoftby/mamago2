"use client";

import { Archive, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotificationActionsBar({
  archived,
  hasNotifications,
  onMarkAllRead,
  onArchiveRead,
  isSubmitting,
}: {
  archived: boolean;
  hasNotifications: boolean;
  onMarkAllRead: () => void | Promise<void>;
  onArchiveRead: () => void | Promise<void>;
  isSubmitting?: boolean;
}) {
  if (archived) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <Button
        type="button"
        variant="outline"
        className="justify-center sm:justify-start"
        disabled={!hasNotifications || isSubmitting}
        onClick={() => void onMarkAllRead()}
      >
        <CheckCheck className="h-4 w-4" />
        Отметить все прочитанными
      </Button>
      <Button
        type="button"
        variant="outline"
        className="justify-center sm:justify-start"
        disabled={!hasNotifications || isSubmitting}
        onClick={() => void onArchiveRead()}
      >
        <Archive className="h-4 w-4" />
        Архивировать прочитанные
      </Button>
    </div>
  );
}
