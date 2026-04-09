"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ACCOUNT_DROPDOWN_WIDTH_CLASS } from "@/components/account/accountDropdownTokens";
import { cn } from "@/lib/utils";

export type AccountDropdownSurfaceProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  narrow: boolean;
  trigger: React.ReactNode;
  sheetTitle?: string;
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
      <>
        <div onClick={() => onOpenChange(true)}>{trigger}</div>
        <BottomSheet
          open={open}
          onOpenChange={onOpenChange}
          title={sheetTitle?.trim() || "Меню аккаунта"}
          hideTitle={!sheetTitle?.trim()}
          showCloseButton={true}
          height="auto"
          className="max-h-[min(90vh,calc(100dvh-1rem))]"
        >
          {children}
        </BottomSheet>
      </>
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
