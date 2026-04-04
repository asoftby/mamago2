"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ACCOUNT_DROPDOWN_WIDTH_CLASS } from "@/components/account/accountDropdownTokens";
import { cn } from "@/lib/utils";

export type AccountDropdownSurfaceProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  narrow: boolean;
  trigger: React.ReactNode;
  sheetTitle: string;
  children: React.ReactNode;
};

/**
 * Единая оболочка: Popover (desktop) или bottom Sheet (mobile / narrow).
 */
export function AccountDropdownSurface({
  open,
  onOpenChange,
  narrow,
  trigger,
  sheetTitle,
  children,
}: AccountDropdownSurfaceProps) {
  if (narrow) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          showCloseButton
          className={cn(
            "z-[60] max-h-[min(90vh,calc(100dvh-1rem))] gap-0 overflow-y-auto rounded-t-2xl border-t border-gray-200 bg-white px-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-lg",
            "w-full max-w-none",
          )}
        >
          <SheetHeader className="space-y-0 px-4 pb-3 text-left">
            <SheetTitle className="text-base font-semibold text-gray-900">
              {sheetTitle}
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={4}
        className={cn(
          "border border-gray-200 bg-white p-0 shadow-md",
          ACCOUNT_DROPDOWN_WIDTH_CLASS,
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
