"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const billingTabs = [
  { name: "Тариф", path: "/billing/plan" },
  { name: "Депозит", path: "/billing/deposit" },
  { name: "История операций", path: "/billing/transactions" },
];

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const usePrefixedPaths = pathname.startsWith("/business");

  const buildTabHref = (path: string) =>
    usePrefixedPaths ? `/business${path}` : path;

  const isCurrentTab = (path: string) =>
    pathname === path || pathname === `/business${path}`;

  return (
    <div className="space-y-6">
      {/* Billing Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {billingTabs.map((tab) => {
            const href = buildTabHref(tab.path);
            const isActive = isCurrentTab(tab.path);
            return (
              <Link
                key={tab.path}
                href={href}
                className={cn(
                  "pb-3 px-1 border-b-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                )}
              >
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}
