import Link from "next/link";
import { MediaCover } from "@/components/ui/media-cover";
import { Badge } from "@/components/ui/badge";
import { H3, Caption } from "@/components/ui/typography";

export function RouteCardVisual({ href, title, imageUrl, meta, badges = [], homeCard = false }: {
  href: string; title: string; imageUrl?: string | null; meta?: string; badges?: string[]; homeCard?: boolean;
}) {
  return (
        <Link href={href} className="block">
          <MediaCover imageUrl={imageUrl} ratio={homeCard ? "4/5" : "1/1"} className={homeCard ? "rounded-[18px] shadow-none" : undefined}>
            {badges.length > 0 && (
              <div className="absolute top-3 left-3 z-10 flex gap-2">
                {badges.map((b, i) => (
                  <Badge
                    key={i}
                    className="bg-white/90 text-foreground shadow-sm border-none backdrop-blur-sm px-2.5 py-0.5 text-xs font-medium"
                  >
                    {b}
                  </Badge>
                ))}
              </div>
            )}
          </MediaCover>

          <div className={homeCard ? "mt-3 px-0.5" : "mt-2.5 px-1"}>
            <H3
              as="span"
              className={homeCard
                ? "text-[15px] font-semibold leading-[1.3] tracking-[-0.01em] transition-colors duration-150 group-hover:text-primary line-clamp-2"
                : "text-sm md:text-base transition-colors duration-150 group-hover:text-primary line-clamp-2"
              }
            >
              {title}
            </H3>
            {meta && (
              <Caption className="text-muted-foreground line-clamp-1">
                {meta}
              </Caption>
            )}
          </div>
        </Link>
  );
}
