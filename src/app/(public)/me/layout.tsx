import React from "react";

/**
 * Личный кабинет /me: тот же UI-шрифт, что и на публичном сайте (NT Somic + стек из `--font-sans`).
 */
export default function MeLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0 font-nt-somic antialiased">{children}</div>;
}
