"use client";

import { MyPlanCapsule } from "./MyPlanCapsule";

/** Десктопный (≥ lg) виджет «Мой план» — та же капсула, что и в нижней панели мобильного экрана. */
export function MyPlanWidget() {
  return (
    <div className="fixed bottom-4 right-4 z-50 hidden w-[min(280px,calc(100vw-2rem))] min-w-0 animate-in fade-in slide-in-from-bottom-4 lg:block">
      <MyPlanCapsule className="w-full shadow-[0_16px_30px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.7)]" openInOverlay />
    </div>
  );
}
