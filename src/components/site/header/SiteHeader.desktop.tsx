import Link from "next/link";
import Image from "next/image";
import { Heart, Search } from "lucide-react";

export function SiteHeaderDesktop() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto w-full max-w-[1140px] px-4">
        <div className="flex h-16 items-center justify-between gap-6">
          {/* LEFT: Logo + City */}
          <div className="flex items-center flex-shrink-0">
            <Link href="/minsk" className="hover:opacity-80 transition-opacity">
              <Image
                src="/favico_mamago.webp"
                alt="MamaGo"
                width={100}
                height={100}
                priority
                className="h-[40px] w-auto"
              />
            </Link>
            <Link
              href="/minsk"
              className="ml-[20px] text-sm border-b border-dashed border-muted-foreground/40 hover:border-muted-foreground/60 transition-colors whitespace-nowrap"
            >
              Минск
            </Link>
          </div>

          {/* CENTER: Search Trigger */}
          <div className="flex-1 mx-auto max-w-[520px]">
            <Link
              href="/minsk"
              className="flex items-center gap-2 w-full rounded-full border px-4 py-2 text-sm text-muted-foreground hover:border-foreground/30 transition-colors"
            >
              <Search className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Найти событие</span>
            </Link>
          </div>

          {/* RIGHT: Saved + Profile */}
          <div className="flex items-center gap-4 flex-shrink-0 whitespace-nowrap">
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
