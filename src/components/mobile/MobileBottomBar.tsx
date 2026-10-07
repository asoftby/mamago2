"use client";

import type { ReactNode } from "react";
import { MobileHeaderActions } from "@/components/site/header/MobileHeaderActions";

/**
 * Плавающая нижняя панель (< lg): виджет «Мой план» (children, flex-1) + 🔔 и 👤.
 * Без children (полноэкранные страницы плана) — только 🔔 и 👤 справа.
 */
export function MobileBottomBar({ children }: { children?: ReactNode }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-3 z-40 flex items-center justify-end gap-2 lg:hidden"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {children}
      <MobileHeaderActions />
    </div>
  );
}
