import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminDashboardBlockSize } from "@/lib/admin/dashboardBlocks";

export interface AdminDashboardBlockProps {
  title: string;
  href?: string;
  size: AdminDashboardBlockSize;
  children: ReactNode;
}

/**
 * Small reusable shell for the modular product blocks (not used by
 * Operations, which has its own distinct node-strip + incident layout).
 * Deliberately minimal — title/href/size/children only, no framework.
 */
export function AdminDashboardBlock({ title, href, size, children }: AdminDashboardBlockProps) {
  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 ${size === "wide" ? "col-span-full" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {href && (
          <Link href={href} className="text-xs text-gray-500 hover:text-gray-800 hover:underline">
            Подробнее →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
