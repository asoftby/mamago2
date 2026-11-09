import { PUBLICATION_BADGE_CLASS } from "@/components/publication-page/publicationStyles";
import { cn } from "@/lib/utils";

/** Category and age presentation shared by detail pages and editorial embeds. */
export function PublicationIdentityBadges({
  category,
  age,
  format,
  className,
}: {
  category?: string | null;
  age?: string | null;
  format?: string | null;
  className?: string;
}) {
  const secondary = "text-[11px] uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]";
  return (
    <div className={cn("flex flex-wrap items-center gap-2.5", className)}>
      {category ? <span className={PUBLICATION_BADGE_CLASS}>{category}</span> : null}
      {age ? <span className={secondary} style={{ fontFamily: "Menlo, monospace" }}>{age}</span> : null}
      {format ? <span className={secondary} style={{ fontFamily: "Menlo, monospace" }}>{format}</span> : null}
    </div>
  );
}
