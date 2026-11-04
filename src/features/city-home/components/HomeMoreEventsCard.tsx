import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EVENT_CARD_SHELL } from "@/components/events";

/** Final carousel item: an explicit catalog path in both audience modes. */
export function HomeMoreEventsCard({ href, onClick }: { href: string; onClick?: () => void }) {
  return <div className={EVENT_CARD_SHELL}>
    <Link href={href} onClick={onClick}
      className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-4 text-center transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="text-base font-semibold">Еще варианты</span>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">Куда пойти <ArrowRight className="size-4" aria-hidden /></span>
    </Link>
  </div>;
}
