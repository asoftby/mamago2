"use client";

import { useMediaQuery } from "react-responsive";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useResendVerificationEmail } from "../hooks/useResendVerificationEmail";

const ACCENT = "#EF8759";

type EmailVerificationGateProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EmailVerificationGate({ open, onOpenChange }: EmailVerificationGateProps) {
  const isDesktop = useMediaQuery({ minWidth: 1024 });
  const { resend, loading, messages } = useResendVerificationEmail();

  const handleResend = async () => {
    const result = await resend();
    if (!result.ok) {
      if (result.code === "RATE_LIMIT") {
        toast.message(messages.rateLimit);
        return;
      }
      toast.error(messages.error);
      return;
    }
    if (result.alreadyVerified) {
      toast.success("Email уже подтверждён");
      onOpenChange(false);
      return;
    }
    toast.success(messages.success);
    onOpenChange(false);
  };

  const copy = (
    <p className="text-sm text-neutral-600 leading-relaxed">
      Это нужно, чтобы мы могли безопасно связать действие с вашим аккаунтом и не потерять важные ответы
      и уведомления.
    </p>
  );

  const actions = (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
      <Button
        type="button"
        variant="ghost"
        className="text-neutral-600"
        onClick={() => onOpenChange(false)}
      >
        Не сейчас
      </Button>
      <Button
        type="button"
        disabled={loading}
        className="text-white font-medium shadow-sm"
        style={{ backgroundColor: ACCENT }}
        onClick={() => void handleResend()}
      >
        {loading ? "Отправляем…" : "Отправить письмо"}
      </Button>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md border-neutral-100 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-neutral-900">
              Подтвердите email, чтобы продолжить
            </DialogTitle>
            <DialogDescription asChild>{copy}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">{actions}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl border-neutral-100 px-5 pb-8 pt-2">
        <SheetHeader className="text-left space-y-2 pb-2">
          <SheetTitle className="text-lg font-semibold text-neutral-900">
            Подтвердите email, чтобы продолжить
          </SheetTitle>
          <SheetDescription asChild>{copy}</SheetDescription>
        </SheetHeader>
        <SheetFooter className="flex-col gap-2 sm:flex-row">{actions}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
