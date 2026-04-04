"use client";

import Link from "next/link";
import { PartyPopper } from "lucide-react";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-6 sm:max-w-md" showCloseButton>
        <DialogHeader className="items-center gap-4 text-center sm:items-center sm:text-center">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20"
            aria-hidden
          >
            <PartyPopper className="h-8 w-8 text-primary" strokeWidth={2} />
          </div>
          <div className="space-y-2">
            <DialogTitle className="text-balance text-xl font-semibold">
              Ваше событие опубликовано
            </DialogTitle>
            <DialogDescription className="text-pretty text-[15px] leading-relaxed">
              Теперь его могут увидеть пользователи и добавить в свой план.
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <PrimaryButton className="w-full" asChild>
            <Link href={activityHref}>Посмотреть событие</Link>
          </PrimaryButton>
          <Button
            variant="outline"
            className="w-full rounded-[16px] py-[14px] h-auto font-semibold"
            asChild
          >
            <Link href="/me/events">К списку событий</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
