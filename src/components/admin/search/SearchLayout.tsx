"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SearchLayoutProps {
  children: React.ReactNode;
}

const tabs = [
  { id: "overview", label: "Overview", href: "/admin/search" },
  { id: "quick-tags", label: "Quick Tags", href: "/admin/search/quick-tags" },
  { id: "synonyms", label: "Synonyms", href: "/admin/search/synonyms" },
  { id: "zero-results", label: "Zero Results", href: "/admin/search/zero-results" },
  { id: "index", label: "Index", href: "/admin/search/index" },
  { id: "ranking", label: "Ranking", href: "/admin/search/ranking" },
];

export function SearchLayout({ children }: SearchLayoutProps) {
  const pathname = usePathname();

  const isActiveTab = (href: string) => {
    if (href === "/admin/search") {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Поиск</h1>
              <p className="text-gray-600 mt-1">
                Управление поиском, аналитика и оптимизация
              </p>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="mt-6 -mb-px">
            <nav className="flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => {
                const isActive = isActiveTab(tab.href);
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={cn(
                      "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                      isActive
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {children}
      </div>
    </div>
  );
}
