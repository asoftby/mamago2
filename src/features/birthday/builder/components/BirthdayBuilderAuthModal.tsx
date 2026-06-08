"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { appendBirthdayBuilderAuthParam } from "@/lib/auth/appendBirthdayBuilderAuthParam";
import { buildAuthUrl } from "@/lib/auth/redirectTo";
import { clearPendingBirthdayBuilderAction } from "../lib/pendingBirthdayBuilderAction";

type BirthdayBuilderAuthModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BirthdayBuilderAuthModal({ open, onOpenChange }: BirthdayBuilderAuthModalProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawNext = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const nextWithMarker = appendBirthdayBuilderAuthParam(rawNext);
  const loginHref = buildAuthUrl({ redirectTo: nextWithMarker });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle className="text-lg leading-snug">
            Войдите в аккаунт,
            <br />
            чтобы сохранить праздник и отправить заявки
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1 leading-relaxed">
            С учётом возраста и интересов ваших детей
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          <Button className="h-11 w-full" asChild>
            <Link href={loginHref}>Войти и продолжить</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              clearPendingBirthdayBuilderAction();
              onOpenChange(false);
            }}
          >
            Позже
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
