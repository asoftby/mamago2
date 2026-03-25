"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  accountDropdownIconClass,
  accountDropdownRowAccent,
  accountDropdownRowDefault,
} from "@/components/account/accountDropdownTokens";
import type { AccountDropdownHeaderModel, AccountMenuRow } from "@/components/account/types";

function RowIcon({ Icon }: { Icon: AccountMenuRow["icon"] }) {
  const Cmp = Icon;
  return <Cmp className={accountDropdownIconClass} aria-hidden />;
}

function MenuRow({
  row,
  onNavigate,
}: {
  row: AccountMenuRow;
  onNavigate?: () => void;
}) {
  if (row.type === "link") {
    const rowClass =
      row.variant === "accent" ? accountDropdownRowAccent : accountDropdownRowDefault;
    return (
      <Link href={row.href} className={rowClass} onClick={onNavigate}>
        <RowIcon Icon={row.icon} />
        {row.label}
      </Link>
    );
  }
  const rowClass =
    row.variant === "accent" ? accountDropdownRowAccent : accountDropdownRowDefault;
  return (
    <button
      type="button"
      className={rowClass}
      onClick={() => {
        row.onClick();
        onNavigate?.();
      }}
    >
      <RowIcon Icon={row.icon} />
      {row.label}
    </button>
  );
}

export type AccountDropdownContentProps = {
  header: AccountDropdownHeaderModel;
  mainItems: AccountMenuRow[];
  contextItems?: AccountMenuRow[];
  /** Для logoutMode `fetch` (по умолчанию) */
  onLogout?: () => void | Promise<void>;
  /** form POST на /api/auth/logout (админка) — onLogout не используется */
  logoutMode?: "fetch" | "form";
  loggingOut?: boolean;
  onNavigate?: () => void;
};

export function AccountDropdownContent({
  header,
  mainItems,
  contextItems,
  onLogout,
  logoutMode = "fetch",
  loggingOut,
  onNavigate,
}: AccountDropdownContentProps) {
  return (
    <div className="flex flex-col bg-white">
      <div className="border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-3">
          {header.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={header.avatarUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-black/[0.06]"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-500 text-[13px] font-semibold text-white">
              {header.initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {header.metaCaption ? (
              <div className="text-xs text-muted-foreground">{header.metaCaption}</div>
            ) : null}
            <div className="truncate text-sm font-medium text-gray-900">
              {header.email}
            </div>
            {header.roleLabel ? (
              <div className="text-xs text-gray-500">{header.roleLabel}</div>
            ) : null}
          </div>
        </div>
      </div>

      <nav className="flex flex-col p-2" aria-label="Меню аккаунта">
        {mainItems.map((row) => (
          <MenuRow key={row.key} row={row} onNavigate={onNavigate} />
        ))}
      </nav>

      {contextItems && contextItems.length > 0 ? (
        <div className="border-t border-gray-200 px-2 py-1">
          {contextItems.map((row) => (
            <MenuRow key={row.key} row={row} onNavigate={onNavigate} />
          ))}
        </div>
      ) : null}

      <div className="border-t border-gray-200 p-2">
        {logoutMode === "form" ? (
          <form action="/api/auth/logout" method="POST" className="w-full">
            <button
              type="submit"
              className={cn(
                accountDropdownRowDefault,
                "w-full disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              <LogOut className={accountDropdownIconClass} aria-hidden />
              Выйти
            </button>
          </form>
        ) : (
          <button
            type="button"
            disabled={loggingOut}
            className={cn(
              accountDropdownRowDefault,
              "w-full disabled:cursor-not-allowed disabled:opacity-60",
            )}
            onClick={() => {
              void onLogout?.();
              onNavigate?.();
            }}
          >
            <LogOut className={accountDropdownIconClass} aria-hidden />
            {loggingOut ? "Выход…" : "Выйти"}
          </button>
        )}
      </div>
    </div>
  );
}
