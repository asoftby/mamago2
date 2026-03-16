"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Calendar, User, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollDirection } from "@/hooks/useScrollDirection";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { scrollDirection, isScrolled } = useScrollDirection(100);

  // Hide bottom nav when scrolling down, show when scrolling up or at top
  const shouldHide = scrollDirection === "down" && isScrolled;

  const navItems = [
    {
      href: "/minsk",
      icon: Search,
      label: "Поиск",
      isActive: pathname.startsWith("/minsk") || pathname === "/"
    },
    {
      href: "/ideas", // или другой путь для идей
      icon: Lightbulb,
      label: "Идеи",
      isActive: pathname.startsWith("/ideas")
    },
    {
      href: "/me",
      icon: Calendar,
      label: "План",
      isActive: pathname.startsWith("/me") && !pathname.startsWith("/me/profile")
    },
    {
      href: "/profile",
      icon: User,
      label: "Профиль",
      isActive: pathname.startsWith("/me/profile") || pathname.startsWith("/business") || pathname.startsWith("/admin")
    }
  ];

  return (
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-in-out",
      shouldHide ? "translate-y-full" : "translate-y-0"
    )}>
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                item.isActive
                  ? "text-[#EF8759]"
                  : "text-gray-500 hover:text-gray-700 active:bg-gray-100"
              )}
            >
              <Icon 
                className={cn(
                  "h-5 w-5 transition-all duration-200",
                  item.isActive && "scale-110"
                )} 
              />
              <span 
                className={cn(
                  "text-xs font-medium transition-all duration-200",
                  item.isActive ? "text-[#EF8759] font-semibold" : "text-gray-500"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}