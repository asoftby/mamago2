"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { NotificationApiRow } from "@/lib/notifications/types";

type ResolvedAction = {
  notificationId: string;
  actionMode: "NONE" | "MODAL" | "PAGE" | "EXTERNAL_URL";
  actionUrl: string | null;
  modalTitle: string | null;
  modalBody: string | null;
};

export async function fetchResolvedNotificationAction(
  notificationId: string,
): Promise<ResolvedAction> {
  const response = await fetch(`/api/notifications/${notificationId}/resolve-action`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve notification action (${response.status})`);
  }

  return response.json() as Promise<ResolvedAction>;
}

export async function handleNotificationClick(params: {
  notification: NotificationApiRow;
  router: AppRouterInstance;
  onAfterRead?: (notificationId: string) => void;
  onClose?: () => void;
}) {
  const action = await fetchResolvedNotificationAction(params.notification.id);
  params.onAfterRead?.(params.notification.id);

  if (action.actionMode === "EXTERNAL_URL" && action.actionUrl) {
    window.open(action.actionUrl, "_blank", "noopener,noreferrer");
    params.onClose?.();
    return;
  }

  if ((action.actionMode === "PAGE" || action.actionMode === "MODAL") && action.actionUrl) {
    params.router.push(action.actionUrl);
    params.onClose?.();
    return;
  }

  // NONE or MODAL without URL — just mark as read, no navigation
  params.onClose?.();
}
