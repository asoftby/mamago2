import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { IconSearch, IconHeart } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Container className="max-w-[1400px]">
        <nav className="grid grid-cols-[auto,minmax(0,520px),auto] items-center gap-6 h-16" role="navigation" aria-label="Главная навигация">
          {/* LEFT: Logo + City */}
          <div className="flex items-center gap-5">
            <Link href="/minsk" className="flex-shrink-0 hover:opacity-80 transition-opacity">
              <Image
                src="/favico_mamago.webp"
                alt="MamaGo"
                width={100}
                height={100}
                priority
                className="h-10 w-auto"
              />
            </Link>
            <Link
              href="/minsk"
              className={cn(
                "text-sm font-medium whitespace-nowrap",
                "border-b border-dashed border-border",
                "hover:border-foreground transition-colors"
              )}
            >
              Минск
            </Link>
          </div>

          {/* CENTER: Search Trigger */}
          <Link
            href="/minsk/events"
            className={cn(
              "flex items-center gap-2 w-full",
              "px-4 py-2 rounded-full",
              "border border-border bg-background",
              "hover:border-foreground transition-colors",
              "text-sm text-muted-foreground"
            )}
          >
            <IconSearch className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">Найти событие</span>
          </Link>

          {/* RIGHT: Saved + Profile */}
          <div className="flex items-center gap-4 justify-self-end">
            <Link
              href="/me"
              className="hover:text-primary transition-colors flex-shrink-0"
              aria-label="Сохранённое"
            >
              <IconHeart className="h-5 w-5" />
            </Link>
            <Link
              href="/me"
              className="text-sm font-medium hover:text-primary transition-colors whitespace-nowrap"
            >
              Профиль
            </Link>
          </div>
        </nav>
      </Container>
    </header>
  );
}
