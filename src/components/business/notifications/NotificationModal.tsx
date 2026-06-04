"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { NotificationApiRow } from "@/lib/notifications/types";

type NotificationModalProps = {
  notification: NotificationApiRow | null;
  title: string | null;
  body: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NotificationModal({
  notification,
  title,
  body,
  open,
  onOpenChange,
}: NotificationModalProps) {
  const actionUrl = notification?.actionUrl ?? notification?.ctaAction ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title ?? notification?.title ?? "Уведомление"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-700">
            {body ?? notification?.body ?? ""}
          </p>
          {notification ? (
            <p className="text-xs text-neutral-400">
              {format(new Date(notification.createdAt), "d MMMM yyyy, HH:mm", { locale: ru })}
            </p>
          ) : null}
          {actionUrl ? (
            <div className="flex justify-end">
              <Button asChild>
                <a
                  href={actionUrl}
                  target={/^https?:\/\//i.test(actionUrl) ? "_blank" : undefined}
                  rel={/^https?:\/\//i.test(actionUrl) ? "noopener noreferrer" : undefined}
                >
                  {notification?.ctaLabel ?? "Открыть"}
                </a>
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
