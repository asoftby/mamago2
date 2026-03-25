"use client";

import Link from "next/link";
import { CircleCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Button } from "@/components/ui/button";

type EventSubmitModerationSuccessDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
};

export function EventSubmitModerationSuccessDialog({
  open,
  onOpenChange,
  eventId,
}: EventSubmitModerationSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-6 sm:max-w-md" showCloseButton>
        <DialogHeader className="items-center gap-4 text-center sm:items-center sm:text-center">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-500/25"
            aria-hidden
          >
            <CircleCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
          </div>
          <div className="space-y-2">
            <DialogTitle className="text-balance text-xl font-semibold">
              Публикация отправлена на модерацию
            </DialogTitle>
            <DialogDescription className="text-pretty text-[15px] leading-relaxed">
              Мы проверим её в ближайшее время. Обычно это занимает до 24 часов. Вы можете
              отредактировать публикацию до одобрения.
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <PrimaryButton className="w-full" asChild>
            <Link href={`/me/events/${eventId}/preview`}>Смотреть, что получилось</Link>
          </PrimaryButton>
          <Button variant="outline" className="w-full rounded-[16px] py-[14px] h-auto font-semibold" asChild>
            <Link href="/me/events">К списку событий</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
