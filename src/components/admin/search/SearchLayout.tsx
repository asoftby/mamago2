"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface SearchLayoutProps {
  children: React.ReactNode;
}

const tabs = [
  { id: "overview", label: "Обзор", href: "/admin/search" },
  { id: "quick-tags", label: "Быстрые теги", href: "/admin/search/quick-tags" },
  { id: "synonyms", label: "Синонимы", href: "/admin/search/synonyms" },
  { id: "zero-results", label: "Без результата", href: "/admin/search/zero-results" },
  { id: "index", label: "Индекс", href: "/admin/search/index" },
  { id: "ranking", label: "Ранжирование", href: "/admin/search/ranking" },
];

export function SearchLayout({ children }: SearchLayoutProps) {
  const pathname = usePathname();
  const activeTabRef = useRef<HTMLAnchorElement | null>(null);

  const isActiveTab = (href: string) => {
    if (href === "/admin/search") {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [pathname]);

  return (
    <div className="min-h-dvh min-w-0 bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <div className="flex min-w-0 items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-gray-900">Поиск</h1>
              <p className="mt-1 text-gray-600">
                Управление поиском, аналитика и оптимизация
              </p>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="-mx-4 -mb-px mt-4 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <nav className="flex w-max min-w-full snap-x snap-proximity gap-2 sm:gap-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const isActive = isActiveTab(tab.href);
                return (
                  <Link
                    key={tab.id}
                    ref={isActive ? activeTabRef : undefined}
                    href={tab.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 shrink-0 snap-start items-center whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:px-1 sm:py-3",
                      isActive
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
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
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </div>
    </div>
  );
}
