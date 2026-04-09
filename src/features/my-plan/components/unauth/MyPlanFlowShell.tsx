"use client";

import { ArrowLeft } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { cn } from "@/lib/utils";

export interface MyPlanFlowShellProps {
  /** Основной заголовок экрана */
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Единая точка закрытия всего «Мой план» */
  onClose: () => void;
  showBack?: boolean;
  onBack?: () => void;
  /** Например «Шаг 2 из 3» для регистрации */
  stepMeta?: string;
  /** Прогресс 1-based для полоски регистрации */
  registerProgress?: { step: number; total: number };
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Вертикальное выравнивание контента в body (короткие формы — по центру области между header и footer). */
  bodyAlign?: "start" | "center";
  /**
   * `header` — заголовок в шапке (онбординг).
   * `body` — заголовок, подзаголовок, шаг и прогресс — в одной колонке над полями формы.
   */
  titlePlacement?: "header" | "body";
  /** Только кнопки в шапке — без заголовка (если заголовок даёт вложенный контент, напр. AuthForm). */
  hideTitle?: boolean;
  /** Hero в шапке unauth auth: eyebrow + продуктовый title + subtitle (вместо простого title). */
  authHeroHeader?: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
}

/**
 * Единая оболочка unauth-флоу «Мой план»: header + scroll body + footer.
 * Desktop (modal) и mobile (sheet) используют один и тот же контент — различается только внешний ResponsiveOverlay.
 */
export function MyPlanFlowShell({
  title,
  subtitle,
  children,
  onClose,
  showBack,
  onBack,
  stepMeta,
  registerProgress,
  footer,
  className,
  bodyClassName,
  bodyAlign = "start",
  titlePlacement = "header",
  hideTitle = false,
  authHeroHeader,
}: MyPlanFlowShellProps) {
  const centerBody = bodyAlign === "center";
  const titleInBody = titlePlacement === "body";
  const showTitleBlock = !hideTitle;
  const hasAuthHero = Boolean(authHeroHeader);

  const progressSegments =
    registerProgress != null ? (
      <div className="mx-auto flex w-full max-w-md justify-center gap-1.5 px-2">
        {Array.from({ length: registerProgress.total }, (_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 max-w-[72px] rounded-full transition-colors",
              i < registerProgress.step ? "bg-[#EF8759]" : "bg-neutral-200",
            )}
          />
        ))}
      </div>
    ) : null;

  const titleBlock = (
    <div className="mx-auto w-full max-w-md space-y-1 text-center">
      <h1 className="text-lg font-semibold leading-snug text-neutral-900 md:text-xl">{title}</h1>
      {subtitle ? <p className="text-sm leading-relaxed text-neutral-500">{subtitle}</p> : null}
      {stepMeta && !registerProgress ? (
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{stepMeta}</p>
      ) : null}
    </div>
  );

  const authHeroBlock = authHeroHeader ? (
    <div className="mx-auto w-full max-w-md space-y-2 px-2 pr-11 text-center sm:pr-12">
      <p className="text-xs font-medium uppercase tracking-[0.06em] text-neutral-400">
        {authHeroHeader.eyebrow}
      </p>
      <h1 className="text-lg font-semibold leading-snug text-neutral-900 md:text-xl">
        {authHeroHeader.title}
      </h1>
      <p className="text-sm leading-relaxed text-neutral-500">{authHeroHeader.subtitle}</p>
    </div>
  ) : null;

  return (
    <div className={cn("flex h-full min-h-0 flex-1 flex-col bg-white", className)}>
      <header
        className={cn(
          "shrink-0 border-b border-neutral-100 px-4 pb-[30px] pt-[30px] md:px-6",
          hasAuthHero ? "md:pb-6 md:pt-6" : "md:flex md:h-[80px] md:items-center md:pb-0 md:pt-0",
        )}
      >
        <div
          className={cn(
            "relative w-full",
            hasAuthHero ? "min-h-0" : "flex h-full items-center justify-center",
          )}
        >
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              className={cn(
                "absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900",
                hasAuthHero ? "top-1 md:top-2" : "top-1/2 -translate-y-1/2",
              )}
              aria-label="Назад"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
            </button>
          ) : null}
          <ModalCloseButton
            onClick={onClose}
            className={cn(
              "absolute right-0",
              hasAuthHero ? "top-2 md:top-3" : "top-1/2 -translate-y-1/2",
            )}
          />
          {!titleInBody && hasAuthHero ? authHeroBlock : null}
          {!titleInBody && !hasAuthHero && showTitleBlock ? titleBlock : null}
        </div>

        {!titleInBody && !hasAuthHero && showTitleBlock && registerProgress ? (
          <div className="mt-1">{progressSegments}</div>
        ) : null}
      </header>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 md:px-6 md:pb-5",
          hasAuthHero ? "pt-4 md:pt-5" : "pt-[90px] md:pt-[90px]",
          centerBody && "flex flex-col",
          bodyClassName,
        )}
      >
        <div
          className={cn(
            "mx-auto w-full max-w-md",
            centerBody && "my-auto shrink-0",
          )}
        >
          {titleInBody && showTitleBlock ? (
            <div className="mb-6 w-full">
              {registerProgress ? (
                <div className="mb-5 space-y-2">
                  <p className="text-center text-xs font-medium uppercase tracking-wide text-neutral-400">
                    Шаг {registerProgress.step} из {registerProgress.total}
                  </p>
                  {progressSegments}
                </div>
              ) : null}
              {titleBlock}
            </div>
          ) : null}
          {children}
        </div>
      </div>

      {footer ? (
        <footer className="shrink-0 border-t border-neutral-200 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6">
          <div className="mx-auto w-full max-w-md">{footer}</div>
        </footer>
      ) : null}
    </div>
  );
}
