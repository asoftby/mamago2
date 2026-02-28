import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { IconButton } from "@/components/ui/IconButton";
import { IconSearch, IconUser, IconChevronDown } from "@/components/ui/icons";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Container className="flex h-14 items-center justify-between">
        {/* Left: Logo */}
        <Link href="/minsk" className="flex items-center gap-2 font-bold text-xl tracking-tight hover:opacity-80 transition-opacity">
          <span className="text-primary">mama</span>
          <span>Go</span>
        </Link>

        {/* Center: City Selector (Desktop only for now, or adaptable) */}
        <div className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-muted/50 cursor-pointer transition-colors text-sm font-medium">
          <span>Минск</span>
          <IconChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 md:gap-2">
          <IconButton label="Поиск" className="hover:bg-muted">
            <IconSearch className="h-5 w-5" />
          </IconButton>
          <IconButton label="Профиль" className="hover:bg-muted">
            <IconUser className="h-5 w-5" />
          </IconButton>
        </div>
      </Container>
    </header>
  );
}
