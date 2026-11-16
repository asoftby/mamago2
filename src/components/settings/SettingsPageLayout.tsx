import type { ReactNode } from "react";
import { AccountPage } from "@/components/account/AccountPage";

/** Настройки пользователя: каркас кабинета (AccountPage); колонка по центру макета. */
export function SettingsPageLayout(props: {
  title: string;
  children: ReactNode;
  maxWidthClassName?: string;
  /** Куда ведёт ссылка назад (родительская страница настроек); null — без ссылки. */
  backHref?: string | null;
  backLabel?: string;
}) {
  return (
    <AccountPage
      title={props.title}
      backHref={props.backHref === null ? undefined : (props.backHref ?? "/me/settings")}
      backLabel={props.backLabel ?? "← Настройки"}
      className={props.maxWidthClassName ?? "max-w-2xl"}
    >
      {props.children}
    </AccountPage>
  );
}
