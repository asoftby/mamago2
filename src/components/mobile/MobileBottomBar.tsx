"use client";

import type { ReactNode } from "react";
import { MobileHeaderActions } from "@/components/site/header/MobileHeaderActions";

/**
 * Нижняя панель (< lg) на сплошной подложке с тем же фоном и границей, что у верхнего хедера:
 * виджет «Мой план» (children, flex-1) + 🔔 и 👤.
 * Без children (полноэкранные страницы плана) — только 🔔 и 👤 справа.
 */
export function MobileBottomBar({ children }: { children?: ReactNode }) {
  return (
    <div
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 border-t border-[#EBEBEB] bg-[#F6F2EA] px-3 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex h-16 items-center justify-end gap-2">
        {children}
        <MobileHeaderActions />
      </div>
    </div>
  );
}
