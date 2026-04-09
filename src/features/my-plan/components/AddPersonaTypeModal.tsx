"use client";

import { Baby, User } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AddPersonaTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectChild: () => void;
  onSelectAdult: () => void;
  layout?: "default" | "desktop";
}

export function AddPersonaTypeModal({
  open,
  onOpenChange,
  onSelectChild,
  onSelectAdult,
  layout = "default",
}: AddPersonaTypeModalProps) {
  const isDesktop = layout === "desktop";

  const content = (
    <div className="flex h-full min-h-0 flex-col">
      <DialogTitle className="sr-only">Кого добавить?</DialogTitle>
      
      {/* Header */}
      <div className="flex-shrink-0 border-b border-neutral-200 px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-900">
            Кого добавить?
          </h2>
          <ModalCloseButton
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-6">
        {/* Child option */}
        <button
          type="button"
          onClick={() => {
            onSelectChild();
            onOpenChange(false);
          }}
          className="flex w-full items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 text-left transition-colors hover:border-neutral-300 hover:bg-neutral-50"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#EF8759]/10">
            <Baby className="h-6 w-6 text-[#EF8759]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-neutral-900">Ребёнок</h3>
            <p className="mt-0.5 text-sm text-neutral-500">
              Укажем возраст и интересы
            </p>
          </div>
        </button>

        {/* Adult option */}
        <button
          type="button"
          onClick={() => {
            onSelectAdult();
            onOpenChange(false);
          }}
          className="flex w-full items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 text-left transition-colors hover:border-neutral-300 hover:bg-neutral-50"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#EF8759]/10">
            <User className="h-6 w-6 text-[#EF8759]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-neutral-900">Взрослый</h3>
            <p className="mt-0.5 text-sm text-neutral-500">
              Настроим предпочтения
            </p>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-neutral-200 bg-white px-5 py-4">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="w-full rounded-full border border-neutral-200 py-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
        >
          Отмена
        </button>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[min(90vh,500px)] w-[calc(100vw-1.5rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:w-full"
          )}
          aria-describedby={undefined}
          showCloseButton={false}
        >
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-auto max-h-[90vh] flex-col gap-0 p-0"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        {content}
      </SheetContent>
    </Sheet>
  );
}
