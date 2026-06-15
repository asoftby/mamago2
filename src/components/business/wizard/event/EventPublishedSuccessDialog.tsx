"use client";

import { PublishedSuccessDialog } from "@/components/shared/PublishedSuccessDialog";

type EventPublishedSuccessDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Полный путь `/{city}/events/{slug|id}` */
  activityHref: string;
};

export function EventPublishedSuccessDialog({
  open,
  onOpenChange,
  activityHref,
}: EventPublishedSuccessDialogProps) {
  return (
    <PublishedSuccessDialog
      open={open}
      onOpenChange={onOpenChange}
      contentType="event"
      viewHref={activityHref}
      listHref="/me/events"
    />
  );
}
