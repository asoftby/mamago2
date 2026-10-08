"use client";

import { MyPlanCapsule } from "./MyPlanCapsule";

/** Десктопный (≥ lg) виджет «Мой план» — та же капсула, что и в нижней панели мобильного экрана. */
export function MyPlanWidget() {
  return (
    <div className="fixed bottom-4 right-4 z-50 hidden w-[min(320px,calc(100vw-2rem))] min-w-0 animate-in fade-in slide-in-from-bottom-4 lg:block">
      <MyPlanCapsule className="w-full shadow-lg" openInOverlay />
    </div>
  );
}
