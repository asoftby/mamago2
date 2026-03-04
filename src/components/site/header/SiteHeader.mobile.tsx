import Link from "next/link";
import Image from "next/image";
import { Heart, Search, User } from "lucide-react";

export function SiteHeaderMobile() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto w-full px-4">
        {/* Row 1: Logo + City + Actions */}
        <div className="flex h-14 items-center justify-between gap-3">
          {/* LEFT: Logo + City */}
          <div className="flex items-center flex-shrink-0 min-w-0">
            <Link href="/minsk" className="hover:opacity-80 transition-opacity flex-shrink-0">
              <Image
                src="/favico_mamago.webp"
                alt="MamaGo"
                width={80}
                height={80}
                priority
                className="h-[32px] w-auto"
              />
            </Link>
            <Link
              href="/minsk"
              className="ml-3 text-sm border-b border-dashed border-muted-foreground/40 hover:border-muted-foreground/60 transition-colors whitespace-nowrap"
            >
              Минск
            </Link>
          </div>

          {/* RIGHT: Saved + Profile */}
          <div className="flex items-center gap-3 flex-shrink-0">
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
        <div className="pb-3">
          <Link
            href="/minsk"
            className="flex items-center gap-2 w-full rounded-full border px-4 py-2 text-sm text-muted-foreground hover:border-foreground/30 transition-colors"
          >
            <Search className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">Найти событие</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
