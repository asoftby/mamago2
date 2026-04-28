import React from "react";

/**
 * Личный кабинет /me: шрифт наследуется от root layout через <html className={ntSomic.variable}>.
 */
export default function MeLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0 antialiased">{children}</div>;
}
