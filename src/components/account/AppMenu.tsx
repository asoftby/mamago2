"use client";

import type { AccountMenuRow } from "@/components/account/types";
import type { AccountMode } from "@/contexts/AccountModeContext";

type AppMenuProps = {
  mode: AccountMode;
  mainItems: AccountMenuRow[];
  renderRow: (row: AccountMenuRow) => React.ReactNode;
};

function UserMenu({ mainItems, renderRow }: Omit<AppMenuProps, "mode">) {
  return <>{mainItems.map(renderRow)}</>;
}

function BusinessMenu({ mainItems, renderRow }: Omit<AppMenuProps, "mode">) {
  return <>{mainItems.map(renderRow)}</>;
}

export function AppMenu({ mode, mainItems, renderRow }: AppMenuProps) {
  if (mode === "business") {
    return <BusinessMenu mainItems={mainItems} renderRow={renderRow} />;
  }
  return <UserMenu mainItems={mainItems} renderRow={renderRow} />;
}

