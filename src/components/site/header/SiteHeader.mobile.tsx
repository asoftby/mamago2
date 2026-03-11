"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, Search, User } from "lucide-react";
import { useHeaderScrolled } from "@/hooks/useHeaderScrolled";
import { cn } from "@/lib/utils";

export function SiteHeaderMobile() {
  const isScrolled = useHeaderScrolled(20);

  return (
    <header 
      className={cn(
        "sticky top-0 z-50 border-b bg-background/80 backdrop-blur transition-all duration-200",
        isScrolled && "shadow-sm"
      )}
    >
      <div className="mx-auto w-full px-4">
        {/* Row 1: Logo + City + Actions */}
        <div 
          className={cn(
            "flex items-center justify-between gap-3 transition-all duration-200",
            isScrolled ? "h-12" : "h-14"
          )}
        >
          {/* LEFT: Logo + City */}
          <div className="flex items-center flex-shrink-0 min-w-0">
            <Link href="/minsk" className="hover:opacity-80 transition-opacity flex-shrink-0">
              <Image
                src="/favico_mamago.webp"
                alt="MamaGo"
                width={80}
                height={80}
                priority
                className={cn(
                  "w-auto transition-all duration-200",
                  isScrolled ? "h-[28px]" : "h-[32px]"
                )}
              />
            </Link>
            <Link
              href="/minsk"
              className={cn(
                "text-sm border-b border-dashed border-muted-foreground/40 hover:border-muted-foreground/60 transition-all duration-200 whitespace-nowrap",
                isScrolled ? "ml-2" : "ml-3"
              )}
            >
              Минск
            </Link>
          </div>

          {/* RIGHT: Saved + Profile */}
          <div 
            className={cn(
              "flex items-center flex-shrink-0 transition-all duration-200",
              isScrolled ? "gap-2" : "gap-3"
            )}
          >
            <Link
              href="/me"
              className="hover:text-primary transition-colors"
              aria-label="Сохранённое"
            >
              <Heart className="h-5 w-5" />
            </Link>
            <Link
              href="/me"
              className="hover:text-primary transition-colors"
              aria-label="Профиль"
            >
              <User className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Row 2: Search */}
        <div 
          className={cn(
            "transition-all duration-200",
            isScrolled ? "pb-2" : "pb-3"
          )}
        >
          <Link
            href="/minsk"
            className={cn(
              "flex items-center gap-2 w-full rounded-full border text-sm text-muted-foreground hover:border-foreground/30 transition-all duration-200",
              isScrolled ? "px-3 py-1.5" : "px-4 py-2"
            )}
          >
            <Search className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">Найти событие</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
