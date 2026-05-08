"use client";

import { useHideOnScrollDirection } from "@/hooks/useHideOnScrollDirection";
import { cn } from "@/lib/utils";

interface MobileBottomBarShellProps {
  children: React.ReactNode;
  /** Дополнительные классы на обёртку */
  className?: string;
  /** Отключить авто-скрытие (например, когда открыта модалка) */
  disableHide?: boolean;
}

/**
 * Единая оболочка для мобильного bottom bar.
 *
 * - Работает только на mobile (lg:hidden)
 * - fixed bottom-0, учитывает safe-area-inset-bottom
 * - При скролле вниз плавно уходит вниз (translateY)
 * - При скролле вверх или у верха страницы — возвращается
 * - Не размонтирует children — только transform
 */
export function MobileBottomBarShell({
  children,
  className,
  disableHide = false,
}: MobileBottomBarShellProps) {
  const scrollHidden = useHideOnScrollDirection({ threshold: 8, topOffset: 24 });
  const hidden = !disableHide && scrollHidden;

  return (
    <div
      className={cn(
        // Только мобилка
        "block lg:hidden",
        // Позиционирование
        "fixed bottom-0 left-0 right-0 z-40",
        // Скрытый shell не должен участвовать в hit-testing
        hidden ? "pointer-events-none" : "pointer-events-auto",
        // Плавный transition
        "transition-transform duration-200 ease-in-out will-change-transform",
        // Скрытие через transform (не display:none — без прыжков)
        hidden
          ? "translate-y-[calc(100%+env(safe-area-inset-bottom,0px))]"
          : "translate-y-0",
        className,
      )}
      // Accessibility: скрытый бар недоступен для AT
      aria-hidden={hidden}
    >
      {children}
    </div>
  );
}
