import type { ReactNode } from "react";
import { AccountPage } from "@/components/account/AccountPage";
import { cn } from "@/lib/utils";

/** Настройки пользователя: каркас кабинета (AccountPage); форма ограничена по ширине. */
export function SettingsPageLayout(props: {
  title: string;
  children: ReactNode;
  maxWidthClassName?: string;
  /** Куда ведёт ссылка назад (родительская страница настроек). */
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <AccountPage
      title={props.title}
      backHref={props.backHref ?? "/me/settings"}
      backLabel={props.backLabel ?? "← Настройки"}
    >
      <div className={cn("w-full", props.maxWidthClassName ?? "max-w-2xl")}>{props.children}</div>
    </AccountPage>
  );
}
