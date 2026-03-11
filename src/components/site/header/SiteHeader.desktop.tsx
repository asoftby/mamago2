"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, Search } from "lucide-react";
import { useHeaderScrolled } from "@/hooks/useHeaderScrolled";
import { cn } from "@/lib/utils";

export function SiteHeaderDesktop() {
  const isScrolled = useHeaderScrolled(20);

  return (
    <header 
      className={cn(
        "sticky top-0 z-50 border-b bg-background/80 backdrop-blur transition-all duration-200",
        isScrolled && "shadow-sm"
      )}
    >
      <div className="mx-auto w-full max-w-[1140px] px-4">
        <div 
          className={cn(
            "flex items-center justify-between gap-6 transition-all duration-200",
            isScrolled ? "h-12" : "h-16"
          )}
        >
          {/* LEFT: Logo + City */}
          <div className="flex items-center flex-shrink-0">
            <Link href="/minsk" className="hover:opacity-80 transition-opacity">
              <Image
                src="/favico_mamago.webp"
                alt="MamaGo"
                width={100}
                height={100}
                priority
                className={cn(
                  "w-auto transition-all duration-200",
                  isScrolled ? "h-[32px]" : "h-[40px]"
                )}
              />
            </Link>
            <Link
              href="/minsk"
              className={cn(
                "text-sm border-b border-dashed border-muted-foreground/40 hover:border-muted-foreground/60 transition-all duration-200 whitespace-nowrap",
                isScrolled ? "ml-3" : "ml-[20px]"
              )}
            >
              Минск
            </Link>
          </div>

          {/* CENTER: Search Trigger */}
          <div className="flex-1 mx-auto max-w-[520px]">
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

          {/* RIGHT: Saved + Profile */}
          <div 
            className={cn(
              "flex items-center flex-shrink-0 whitespace-nowrap transition-all duration-200",
              isScrolled ? "gap-3" : "gap-4"
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
              className="text-sm hover:text-primary transition-colors"
            >
              Профиль
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
