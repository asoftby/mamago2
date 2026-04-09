import type { ReactNode } from "react";
import type { AccountDropdownContentProps } from "@/components/account/AccountDropdownContent";

export type AccountDropdownModel = AccountDropdownContentProps & {
  /** Заголовок нижнего sheet на мобильном; без него — только скрытый title для a11y */
  sheetTitle?: string;
};

export type AccountDropdownProps = AccountDropdownModel & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  narrow: boolean;
  trigger: ReactNode;
};
