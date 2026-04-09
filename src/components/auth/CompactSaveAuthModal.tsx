"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { cn } from "@/lib/utils";
import { CompactSaveAuthPanel } from "@/components/auth/CompactSaveAuthPanel";

export interface CompactSaveAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextHref: string;
  title: string;
  subtitle: string;
  dialogTitle?: string;
  onAuthSuccess?: () => void;
  entityType?: "event" | "route" | string;
}

export function CompactSaveAuthModal({
  open,
  onOpenChange,
  nextHref,
  title,
  subtitle,
  dialogTitle = "Вход для сохранения",
  onAuthSuccess,
}: CompactSaveAuthModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dismissible={false}
        showCloseButton={false}
        className={cn(
          "max-h-[min(90vh,600px)] gap-0 overflow-y-auto overflow-x-visible border-0 bg-transparent shadow-none",
          "px-5 pb-6 pt-10 sm:px-8 sm:pb-8 sm:pt-12",
          "sm:max-w-[400px]",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="relative mx-auto w-full max-w-[380px]">
          <CompactSaveAuthPanel
            title={title}
            subtitle={subtitle}
            nextHref={nextHref}
            onAuthSuccess={onAuthSuccess}
            onClose={() => onOpenChange(false)}
            resetKey={open ? "open" : "closed"}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
