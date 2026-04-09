"use client";

import {
  mobileSheetHeightFull,
  mobileSheetShellBase,
} from "@/components/ui/overlay-layout";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { NotificationsPanel } from "./NotificationsPanel";

export type NotificationsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stream?: "user" | "business";
  onNotificationRead?: () => void;
};

/**
 * Мобильная оболочка: bottom sheet. На десктопе не рендерится — там Popover в NotificationsDropdown.
 */
export function NotificationsModal({
  open,
  onOpenChange,
  stream = "user",
  onNotificationRead,
}: NotificationsModalProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  if (isDesktop) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn(
          mobileSheetShellBase,
          mobileSheetHeightFull,
          "z-[60] gap-0 p-0",
        )}
      >
        <SheetTitle className="sr-only">Уведомления</SheetTitle>
        <NotificationsPanel
          key={String(open)}
          open={open}
          stream={stream}
          onNotificationRead={onNotificationRead}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
