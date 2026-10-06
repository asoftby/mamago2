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
        className="flex flex-wrap gap-1 border-b border-gray-200"
        aria-label="SEO"
      >
        {SEO_PRIMARY_NAV.map((item) => {
          const active = isSeoNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative -mb-px inline-flex items-center rounded-t-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border border-b-0 border-gray-200 bg-white text-gray-900"
                  : "border border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              )}
            >
              {item.label}
            </Link>
          );
        })}
        <Link
          href={SEO_SETTINGS_ENTRY.href}
          className={cn(
            "relative -mb-px inline-flex items-center rounded-t-md px-3 py-2.5 text-sm font-medium transition-colors",
            settingsOpen
              ? "border border-b-0 border-gray-200 bg-white text-gray-900"
              : "border border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900",
          )}
        >
          {SEO_SETTINGS_ENTRY.label}
        </Link>
      </nav>

      {settingsOpen ? (
        <nav
          className="flex flex-wrap gap-2"
          aria-label="Настройки SEO"
        >
          {SEO_SETTINGS_NAV.map((item) => {
            const active = isSeoNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-gray-900 bg-gray-900 text-white"
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
