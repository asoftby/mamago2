"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const billingTabs = [
  { name: "Тариф", href: "/business/billing/plan" },
  { name: "Депозит", href: "/business/billing/deposit" },
  { name: "История операций", href: "/business/billing/transactions" },
];

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Billing Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {billingTabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
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
