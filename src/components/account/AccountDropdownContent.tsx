"use client";

import { BYN_SYMBOL } from "@/lib/formatters/format-price";
import Link from "next/link";
import { Building2, Check, LogOut, Shield, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  accountDropdownIconClass,
  accountDropdownRowAccent,
  accountDropdownRowDefault,
} from "@/components/account/accountDropdownTokens";
import { AppMenu } from "@/components/account/AppMenu";
import type { AccountDropdownHeaderModel, AccountMenuRow } from "@/components/account/types";
import type { AccountMode } from "@/contexts/AccountModeContext";
import { getCurrentBrowserAppContextWithPath } from "@/lib/routing/appContext";

function RowIcon({ Icon }: { Icon: AccountMenuRow["icon"] }) {
  const Cmp = Icon;
  return <Cmp className={accountDropdownIconClass} aria-hidden />;
}

function MenuRow({
  row,
  onNavigate,
  rowClassName,
}: {
  row: AccountMenuRow;
  onNavigate?: () => void;
  rowClassName?: string;
}) {
  if (row.type === "link") {
    const rowClass =
      row.variant === "accent" ? accountDropdownRowAccent : accountDropdownRowDefault;
    return (
      <Link href={row.href} className={cn(rowClass, rowClassName)} onClick={onNavigate}>
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
      className={cn(rowClass, rowClassName)}
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
  mode?: AccountMode;
  onSwitchMode?: (next: AccountMode) => void;
  businessModeAvailable?: boolean;
  businessLabel?: string;
  businessBalanceBYN?: number;
  onTopUpBalance?: () => void;
  ctaBlock?: {
    title: string;
    actionLabel: string;
    onAction: () => void;
  };
  /**
   * Админ-хост: переключатель «Личный аккаунт» / «Админ-панель» (`chromeTone="admin"` даёт серый лоток).
   */
  adminPersonalSwitcher?: {
    onGoPersonal: () => void;
    onGoAdmin: () => void;
  };
  /** Для logoutMode `fetch` (по умолчанию) */
  onLogout?: () => void | Promise<void>;
  /** form POST на /api/auth/logout (админка) — onLogout не используется */
  logoutMode?: "fetch" | "form";
  loggingOut?: boolean;
  onNavigate?: () => void;
  /**
   * Нижний sheet на мобильном: отступ справа под absolute «Закрыть», верх совпадает с top-4 кнопки.
   * Не задаётся в билдерах — прокидывается из AccountDropdown при narrow.
   */
  sheetLayout?: boolean;
  /**
   * Визуал как у кнопки профиля: `user` — публика (peach primary/10); `admin` — админка (серый); `business` — кабинет партнёра (пастельный синий).
   * @default "user"
   */
  chromeTone?: "user" | "admin" | "business";
};

export function AccountDropdownContent({
  header,
  mainItems,
  contextItems,
  mode,
  onSwitchMode,
  businessModeAvailable = true,
  businessLabel = "MamaGo",
  businessBalanceBYN,
  onTopUpBalance,
  ctaBlock,
  adminPersonalSwitcher,
  onLogout,
  logoutMode = "fetch",
  loggingOut,
  onNavigate,
  sheetLayout = false,
  chromeTone = "user",
}: AccountDropdownContentProps) {
  // Determine current app context from hostname/pathname
  const currentContext = typeof window !== "undefined" 
    ? getCurrentBrowserAppContextWithPath() 
    : "personal";

  const adminContextRow = contextItems?.find(
    (row): row is Extract<AccountMenuRow, { type: "button" }> =>
      row.key === "admin" && row.type === "button",
  );
  const hasRoleSwitcher =
    !!mode &&
    !!onSwitchMode &&
    (businessModeAvailable || Boolean(adminContextRow));
  const contextItemsWithoutAdmin = contextItems?.filter(
    (row) => !(row.key === "admin" && row.type === "button"),
  );
  /** Без переключателя ролей (админка): контекст — в той же полосе, что у /me под шапкой */
  const preNavContextItems =
    !hasRoleSwitcher && contextItemsWithoutAdmin && contextItemsWithoutAdmin.length > 0
      ? contextItemsWithoutAdmin
      : null;

  const switcherTrayClass =
    chromeTone === "admin"
      ? "rounded-xl bg-gray-100 p-1"
      : chromeTone === "business"
        ? "rounded-xl bg-sky-100/85 p-1"
        : "rounded-xl bg-primary/10 p-1";

  const avatarFallbackInnerClass =
    chromeTone === "admin"
      ? "flex h-full w-full items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-700"
      : chromeTone === "business"
        ? "flex h-full w-full items-center justify-center rounded-full bg-sky-100 text-[11px] font-semibold text-sky-900"
        : "flex h-full w-full items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary";

  return (
    <div className="flex flex-col bg-white">
      <div
        className={cn(
          "border-b border-gray-200 px-4",
          sheetLayout ? "pb-4 pt-4 pr-14" : "py-4",
        )}
      >
        <div
          className={cn(
            "flex gap-3",
            sheetLayout ? "items-start" : "items-center",
          )}
        >
          {header.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={header.avatarUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-black/[0.06]"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm">
              <span className={avatarFallbackInnerClass}>
                {header.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold text-gray-900">
              {header.displayName}
            </div>
            {header.personaSubtitle ? (
              <div className="truncate text-xs text-gray-600 mt-0.5">
                {header.personaSubtitle}
              </div>
            ) : null}
            <div className="truncate text-xs text-gray-400 mt-0.5">
              {header.email}
            </div>
            {header.roleLabel && (
              <div className="text-xs text-gray-500 mt-0.5">{header.roleLabel}</div>
            )}
          </div>
        </div>
      </div>

      {adminPersonalSwitcher ? (
        <div className="border-b border-gray-200 p-2">
          <div className={switcherTrayClass}>
            <button
              type="button"
              className={cn(
                accountDropdownRowDefault,
                "w-full justify-between rounded-lg",
                currentContext === "personal" && "bg-white shadow-sm",
              )}
              onClick={() => {
                adminPersonalSwitcher.onGoPersonal();
                onNavigate?.();
              }}
            >
              <span className="inline-flex items-center gap-2">
                <UserRound className={accountDropdownIconClass} aria-hidden />
                Личный аккаунт
              </span>
              {currentContext === "personal" ? (
                <Check className="h-4 w-4 text-primary" aria-hidden />
              ) : null}
            </button>
            <button
              type="button"
              className={cn(
                accountDropdownRowDefault,
                "mt-1 w-full justify-between rounded-lg",
                currentContext === "admin" && "bg-white shadow-sm",
              )}
              onClick={() => {
                adminPersonalSwitcher.onGoAdmin();
                onNavigate?.();
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Shield className={accountDropdownIconClass} aria-hidden />
                Админ-панель
              </span>
              {currentContext === "admin" ? (
                <Check className="h-4 w-4 text-primary" aria-hidden />
              ) : null}
            </button>
          </div>
        </div>
      ) : null}

      {hasRoleSwitcher ? (
        <div className="border-b border-gray-200 p-2">
          <div className={switcherTrayClass}>
            <button
              type="button"
              className={cn(
                accountDropdownRowDefault,
                "w-full justify-between rounded-lg",
                currentContext === "personal" && "bg-white shadow-sm",
              )}
              onClick={() => {
                onSwitchMode("personal");
                onNavigate?.();
              }}
            >
              <span className="inline-flex items-center gap-2">
                <UserRound className={accountDropdownIconClass} aria-hidden />
                Личный аккаунт
              </span>
              {currentContext === "personal" ? <Check className="h-4 w-4 text-primary" /> : null}
            </button>
            {adminContextRow ? (
              <button
                type="button"
                className={cn(
                  accountDropdownRowDefault,
                  "mt-1 w-full justify-between rounded-lg",
                  currentContext === "admin" && "bg-white shadow-sm",
                )}
                onClick={() => {
                  adminContextRow.onClick();
                  onNavigate?.();
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <adminContextRow.icon className={accountDropdownIconClass} aria-hidden />
                  Админ-панель
                </span>
                {currentContext === "admin" ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : null}
              </button>
            ) : null}
            {businessModeAvailable ? (
              <button
                type="button"
                className={cn(
                  accountDropdownRowDefault,
                  "mt-1 w-full justify-between rounded-lg",
                  currentContext === "business" && "bg-white shadow-sm",
                )}
                onClick={() => {
                  onSwitchMode("business");
                  onNavigate?.();
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <Building2 className={accountDropdownIconClass} aria-hidden />
                  Бизнес: {businessLabel}
                </span>
                {currentContext === "business" ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {mode === "business" && typeof businessBalanceBYN === "number" ? (
        <div className="border-b border-gray-200 px-3 py-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Баланс</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {businessBalanceBYN.toFixed(2)} {BYN_SYMBOL}
            </p>
            {businessBalanceBYN <= 0 ? (
              <p className="mt-1 text-xs text-gray-500">
                Пополните, чтобы запускать продвижение
              </p>
            ) : null}
            <button
              type="button"
              className="mt-2 inline-flex items-center justify-center gap-1 rounded-xl bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-stone-800 active:scale-[0.98]"
              onClick={() => {
                onTopUpBalance?.();
                onNavigate?.();
              }}
            >
              Пополнить
            </button>
          </div>
        </div>
      ) : null}

      {preNavContextItems ? (
        <div className="border-b border-gray-200 p-2">
          <div className={switcherTrayClass}>
            {preNavContextItems.map((row, index) => (
              <MenuRow
                key={row.key}
                row={row}
                onNavigate={onNavigate}
                rowClassName={cn(
                  "w-full justify-between rounded-lg",
                  index > 0 && "mt-1",
                )}
              />
            ))}
          </div>
        </div>
      ) : null}

      <nav className="flex flex-col p-2" aria-label="Меню аккаунта">
        <AppMenu
          mode={mode ?? "personal"}
          mainItems={mainItems}
          renderRow={(row) => (
            <MenuRow key={row.key} row={row} onNavigate={onNavigate} />
          )}
        />
      </nav>

      {!preNavContextItems && contextItemsWithoutAdmin && contextItemsWithoutAdmin.length > 0 ? (
        <div className="border-t border-gray-200 px-2 py-1">
          {contextItemsWithoutAdmin.map((row) => (
            <MenuRow key={row.key} row={row} onNavigate={onNavigate} />
          ))}
        </div>
      ) : null}

      {ctaBlock ? (
        <div className="border-t border-gray-200 px-3 py-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-blue-900">{ctaBlock.title}</p>
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Building2 className="h-4 w-4" aria-hidden />
              </div>
            </div>
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-800"
              onClick={() => {
                ctaBlock.onAction();
                onNavigate?.();
              }}
            >
              {ctaBlock.actionLabel}
            </button>
          </div>
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
