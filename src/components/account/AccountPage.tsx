import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { Surface } from "@/components/ui/surface";
import { H2 } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

/**
 * Единый каркас страниц личного кабинета `/me/*` (эталон — «Моя семья»).
 * Только разметка: контейнер, одна ссылка назад, h1, вводный текст, действия.
 * Размер h1 на телефоне (34px) задаёт `.me-page h1` в globals.css.
 */
export type AccountPageProps = {
  title: ReactNode;
  lead?: ReactNode;
  /** Родительская страница. Не передавайте на корневой `/me`. */
  backHref?: string;
  backLabel?: string;
  /** Кнопки справа от заголовка (например «Настройки»). */
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export function AccountPage({
  title,
  lead,
  backHref,
  backLabel = "← Мой аккаунт",
  actions,
  className,
  children,
}: AccountPageProps) {
  return (
    <main className={cn("mx-auto min-h-[70vh] w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8", className)}>
      {backHref ? (
        <Link href={backHref} className="inline-flex min-h-11 items-center text-sm text-neutral-600 hover:text-neutral-900">
          {backLabel}
        </Link>
      ) : null}
      <header className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", backHref ? "mt-3" : "mt-0")}>
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">{title}</h1>
          {lead ? <p className="mt-2 max-w-2xl text-neutral-600">{lead}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </main>
  );
}

/** Карточка кабинета: Surface (белый фон, рамка, радиус 20px) + необязательный H2. */
export function AccountCard({
  title,
  action,
  className,
  children,
  ...rest
}: {
  title?: ReactNode;
  action?: ReactNode;
} & Omit<ComponentProps<"div">, "title">) {
  return (
    <Surface variant="elevated" className={cn("p-6", className)} {...rest}>
      {title || action ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <H2 className="min-w-0">{title}</H2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </Surface>
  );
}
