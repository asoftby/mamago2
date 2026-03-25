"use client";

import { AccountDropdownContent } from "@/components/account/AccountDropdownContent";
import { AccountDropdownSurface } from "@/components/account/AccountDropdownSurface";
import type { AccountDropdownProps } from "@/components/account/AccountDropdown.types";

export type { AccountDropdownProps, AccountDropdownModel } from "@/components/account/AccountDropdown.types";
export type { AccountDropdownContentProps } from "@/components/account/AccountDropdownContent";

/**
 * Стандартный паттерн меню пользователя. Конфиг пунктов — через lib/account/accountMenuBuilders.
 */
export function AccountDropdown({
  open,
  onOpenChange,
  narrow,
  trigger,
  sheetTitle,
  ...content
}: AccountDropdownProps) {
  return (
    <AccountDropdownSurface
      open={open}
      onOpenChange={onOpenChange}
      narrow={narrow}
      trigger={trigger}
      sheetTitle={sheetTitle}
    >
      <AccountDropdownContent {...content} />
    </AccountDropdownSurface>
  );
}
