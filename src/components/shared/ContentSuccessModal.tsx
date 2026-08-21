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
import { useHydrated } from "@/hooks/use-hydrated";
import { sameOriginUrl } from "@/lib/client/sameOriginUrl";
import type { ResolvedContentSuccessState } from "@/lib/content-success/types";

type ContentSuccessModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ResolvedContentSuccessState | null;
};

export function ContentSuccessModal({
  open,
  onOpenChange,
  state,
}: ContentSuccessModalProps) {
  const hydrated = useHydrated();

  if (!state) {
    return null;
  }

  const openHref =
    hydrated && state.openAction ? sameOriginUrl(state.openAction.href) : state.openAction?.href;
  const editHref =
    hydrated && state.continueEditingAction
      ? sameOriginUrl(state.continueEditingAction.href)
      : state.continueEditingAction?.href;
  const listHref =
    hydrated && state.listAction ? sameOriginUrl(state.listAction.href) : state.listAction?.href;

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
              {state.title}
            </DialogTitle>
            <DialogDescription className="text-pretty text-[15px] leading-relaxed">
              {state.description}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {state.openAction && openHref ? (
            <PrimaryButton className="w-full" asChild>
              {state.openAction.target === "_blank" ? (
                <a href={openHref} target="_blank" rel="noopener noreferrer">
                  {state.openAction.label}
                </a>
              ) : (
                <Link href={openHref}>{state.openAction.label}</Link>
              )}
            </PrimaryButton>
          ) : null}
          {state.continueEditingAction && editHref ? (
            <Button
              variant="secondary"
              className="h-auto w-full rounded-[16px] py-[14px] font-semibold"
              asChild
            >
              <Link href={editHref}>{state.continueEditingAction.label}</Link>
            </Button>
          ) : null}
          {state.listAction && listHref ? (
            <Button
              variant="outline"
              className="h-auto w-full rounded-[16px] py-[14px] font-semibold"
              asChild
            >
              <Link href={listHref}>{state.listAction.label}</Link>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
