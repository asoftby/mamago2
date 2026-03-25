"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SEO_CONTROL_NAV, isSeoNavActive } from "@/lib/admin/seoNavConfig";

export function SeoSubNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-gray-200"
      aria-label="SEO Control Center"
    >
      {SEO_CONTROL_NAV.map((item) => {
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
    </nav>
  );
}
