"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  SEO_PRIMARY_NAV,
  SEO_SETTINGS_ENTRY,
  SEO_SETTINGS_NAV,
  isSeoNavActive,
  isSeoSettingsPath,
} from "@/lib/admin/seoNavConfig";

export function SeoSubNav() {
  const pathname = usePathname();
  const settingsOpen = isSeoSettingsPath(pathname);

  return (
    <div className="space-y-3">
      <nav
        className="-mx-1 flex flex-nowrap gap-1 overflow-x-auto border-b border-gray-200 px-1 scrollbar-none"
        aria-label="SEO"
      >
        {SEO_PRIMARY_NAV.map((item) => {
          const active = isSeoNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative -mb-px shrink-0 inline-flex items-center rounded-t-md border border-b-0 px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-gray-200 border-b-2 border-b-primary bg-white text-primary shadow-sm"
                  : "border-transparent border-b-2 border-b-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-800",
              )}
            >
              {item.label}
            </Link>
          );
        })}
        <Link
          href={SEO_SETTINGS_ENTRY.href}
          aria-current={settingsOpen ? "page" : undefined}
          className={cn(
            "relative -mb-px shrink-0 inline-flex items-center rounded-t-md border border-b-0 px-3 py-2.5 text-sm font-medium transition-colors",
            settingsOpen
              ? "border-gray-200 border-b-2 border-b-primary bg-white text-primary shadow-sm"
              : "border-transparent border-b-2 border-b-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-800",
          )}
        >
          {SEO_SETTINGS_ENTRY.label}
        </Link>
      </nav>

      {settingsOpen ? (
        <nav className="flex flex-wrap gap-2" aria-label="Настройки SEO">
          {SEO_SETTINGS_NAV.map((item) => {
            const active = isSeoNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
