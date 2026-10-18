import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { canOptimizeWithNextImage } from "@/lib/media/nextImagePolicy";

export function JournalCard({ href, title, imageUrl, categoryLabel, readTime, tone = 0, homeCard = false }: {
  href: string; title: string; imageUrl?: string | null; categoryLabel?: string | null;
  readTime?: number | null; tone?: number; homeCard?: boolean;
}) {
  return (
            <Link
              href={href}
              className={cn(
                "block transition-colors group",
                homeCard ? "bg-transparent" : "rounded-2xl bg-white p-3 hover:bg-neutral-50/80",
              )}
            >
              <div
                className={cn(
                  "relative w-full mb-3 overflow-hidden bg-gradient-to-br",
                  homeCard ? "rounded-[18px]" : "aspect-square rounded-xl",
                  [
                    "from-[#F2C8A7] to-[#E89460]",
                    "from-[#CDE3D6] to-[#9CC1AC]",
                    "from-[#F6D567] to-[#E8B935]",
                    "from-[#E6DBC8] to-[#C9BCA0]",
                  ][tone % 4],
                )}
                style={homeCard ? { aspectRatio: "4 / 5" } : undefined}
              >
                {imageUrl && canOptimizeWithNextImage(imageUrl) ? (
                  <Image
                    src={imageUrl}
                    alt={title}
                    fill
                    sizes={"(min-width: 1024px) 250px, 50vw"}
                    className="object-cover"
                  />
                ) : imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- unknown external hosts are intentionally outside the Next/Image allowlist.
                  <img
                    src={imageUrl}
                    alt={title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="mb-1.5 flex items-center gap-2">
                {categoryLabel && (
                  <p className="min-w-0 truncate font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
                    {categoryLabel}
                  </p>
                )}
                {readTime != null && <p className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[11px] text-[rgba(20,18,16,0.55)]">
                  <span aria-hidden="true">~</span>
                  {readTime} мин.
                </p>}
              </div>
              <p className={cn(
                  "font-semibold text-neutral-900 transition-colors duration-150 group-hover:text-primary",
                  homeCard
                    ? "line-clamp-2 text-[15px] leading-[1.3] tracking-[-0.01em]"
                    : "line-clamp-3 text-sm leading-snug",
                )}>
                {title}
              </p>
            </Link>
  );
}
