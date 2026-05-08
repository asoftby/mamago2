"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Wallet, 
  CreditCard, 
  FileText, 
  Building2, 
  History 
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  BUSINESS_BILLING_BALANCE_HREF,
  BUSINESS_BILLING_PLAN_HREF,
  BUSINESS_BILLING_DOCUMENTS_HREF,
  BUSINESS_BILLING_REQUISITES_HREF,
  BUSINESS_BILLING_HISTORY_HREF,
} from "@/lib/business/navigation";

interface Tab {
  label: string;
  href: string;
  icon: LucideIcon;
  match: string[];
}

const tabs: Tab[] = [
  {
    label: "Баланс",
    href: BUSINESS_BILLING_BALANCE_HREF,
    icon: Wallet,
    match: ["/business/billing", "/business/billing/deposit"], // Support legacy /deposit route
  },
  {
    label: "Тариф",
    href: BUSINESS_BILLING_PLAN_HREF,
    icon: CreditCard,
    match: ["/business/billing/plan"],
  },
  {
    label: "Документы",
    href: BUSINESS_BILLING_DOCUMENTS_HREF,
    icon: FileText,
    match: ["/business/billing/documents"],
  },
  {
    label: "Реквизиты",
    href: BUSINESS_BILLING_REQUISITES_HREF,
    icon: Building2,
    match: ["/business/billing/requisites"],
  },
  {
    label: "История",
    href: BUSINESS_BILLING_HISTORY_HREF,
    icon: History,
    match: ["/business/billing/history", "/business/billing/transactions"], // Support legacy /transactions route
  },
];

export function BillingTabs() {
  const pathname = usePathname();

  const isActive = (tab: Tab) => {
    // Exact match for root /business/billing
    if (tab.href === BUSINESS_BILLING_BALANCE_HREF && pathname === BUSINESS_BILLING_BALANCE_HREF) {
      return true;
    }
    
    // Match other tabs
    return tab.match.some((match) => {
      if (match === BUSINESS_BILLING_BALANCE_HREF) return pathname === BUSINESS_BILLING_BALANCE_HREF;
      return pathname.startsWith(match);
    });
  };

  return (
    <div className="border-b border-stone-200 bg-white">
      <div className="flex gap-1 px-6 overflow-x-auto">
        {tabs.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium
                border-b-2 transition-colors whitespace-nowrap
                ${
                  active
                    ? "border-[#EF8759] text-[#EF8759]"
                    : "border-transparent text-stone-600 hover:text-stone-900 hover:border-stone-300"
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
