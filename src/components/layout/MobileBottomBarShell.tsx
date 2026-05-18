"use client";

import { useEffect, useRef } from "react";
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
 *
 * Accessibility:
 * - При скрытии снимает фокус с любого элемента внутри (blur)
 * - Использует `inert` вместо `aria-hidden` — это предотвращает
 *   "Blocked aria-hidden on an element because its descendant retained focus"
 * - `inert` автоматически блокирует фокус, pointer events и AT
 */
export function MobileBottomBarShell({
  children,
  className,
  disableHide = false,
}: MobileBottomBarShellProps) {
  const scrollHidden = useHideOnScrollDirection({ threshold: 8, topOffset: 24 });
  const hidden = !disableHide && scrollHidden;
  const ref = useRef<HTMLDivElement>(null);

  // Снимаем фокус перед скрытием, чтобы не было
  // "Blocked aria-hidden on an element because its descendant retained focus"
  useEffect(() => {
    if (!hidden) return;
    const el = ref.current;
    if (!el) return;
    if (el.contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [hidden]);

  return (
    <div
      ref={ref}
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
      // inert блокирует фокус, pointer events и AT для скрытого бара.
      // Это правильная замена aria-hidden для интерактивных контейнеров:
      // предотвращает "Blocked aria-hidden on an element because its descendant retained focus"
      inert={hidden}
    >
      {children}
    </div>
  );
}
