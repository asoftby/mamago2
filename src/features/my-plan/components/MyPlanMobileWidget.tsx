"use client";

import { MyPlanCapsule } from "./MyPlanCapsule";

/** Мобильный (< lg) «Мой план» в нижней панели: [капсула flex:1] [🔔] [👤]. Сжимается только капсула. */
export function MyPlanMobileWidget() {
  return <MyPlanCapsule className="min-w-0 flex-1" />;
}
