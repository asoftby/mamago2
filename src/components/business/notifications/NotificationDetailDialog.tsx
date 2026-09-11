"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type NotificationDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string | null;
  body: string | null;
};

export function NotificationDetailDialog({
  open,
  onOpenChange,
  title,
  body,
}: NotificationDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(85vh,720px)] max-w-xl overflow-hidden rounded-3xl p-0">
        <DialogHeader className="border-b border-neutral-200 px-6 py-5 text-left">
          <DialogTitle className="pr-8 text-xl leading-snug text-neutral-950">
            {title || "Сообщение"}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(min(85vh,720px)-88px)] overflow-y-auto px-6 py-5">
          <div className="whitespace-pre-wrap text-sm leading-6 text-neutral-700">
            {body || "Сообщение без текста"}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
