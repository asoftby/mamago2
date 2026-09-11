"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { NotificationApiRow } from "@/lib/notifications/types";

export type ResolvedNotificationAction = {
  notificationId: string;
  actionMode: "NONE" | "MODAL" | "PAGE" | "EXTERNAL_URL";
  actionUrl: string | null;
  modalTitle: string | null;
  modalBody: string | null;
};

export async function fetchResolvedNotificationAction(
  notificationId: string,
): Promise<ResolvedNotificationAction> {
  const response = await fetch(`/api/notifications/${notificationId}/resolve-action`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve notification action (${response.status})`);
  }

  return response.json() as Promise<ResolvedNotificationAction>;
}

export async function handleNotificationClick(params: {
  notification: NotificationApiRow;
  router: AppRouterInstance;
  onAfterRead?: (notificationId: string) => void;
  onModal?: (action: ResolvedNotificationAction) => void;
  onClose?: () => void;
}): Promise<ResolvedNotificationAction> {
  const action = await fetchResolvedNotificationAction(params.notification.id);
  params.onAfterRead?.(params.notification.id);

  if (action.actionMode === "EXTERNAL_URL" && action.actionUrl) {
    window.open(action.actionUrl, "_blank", "noopener,noreferrer");
    params.onClose?.();
    return action;
  }

  if (action.actionMode === "PAGE" && action.actionUrl) {
    params.router.push(action.actionUrl);
    params.onClose?.();
    return action;
  }

  if (action.actionMode === "MODAL") {
    if (action.actionUrl) {
      params.router.push(action.actionUrl);
      params.onClose?.();
    } else {
      params.onModal?.(action);
    }
    return action;
  }

  params.onClose?.();
  return action;
}
