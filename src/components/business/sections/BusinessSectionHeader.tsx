import { Info } from "lucide-react";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import { cn } from "@/lib/utils";

interface BusinessSectionHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  /** Цвет eyebrow: 'default' (серый) или 'primary' */
  eyebrowVariant?: "default" | "primary";
}

export function BusinessSectionHeader({
  eyebrow,
  title,
  description,
  actions,
  eyebrowVariant = "default",
}: BusinessSectionHeaderProps) {
  return (
    <div className="space-y-3">
      <BusinessSurfaceCard className="relative overflow-hidden px-6 py-6 md:px-7 md:py-7">
        <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(251,191,36,0.08)_0%,rgba(255,255,255,0)_100%)]" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl space-y-2">
            {eyebrow ? (
              <p
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.2em]",
                  eyebrowVariant === "primary" ? "text-primary" : "text-stone-400",
                )}
              >
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-3xl font-semibold tracking-tight text-stone-950 md:text-[2rem]">
              {title}
            </h1>
          </div>
          {actions ? <div className="relative shrink-0">{actions}</div> : null}
        </div>
      </BusinessSurfaceCard>
      {/* Technical clarification outside the white panel; H1 stays first. */}
      <div
        role="note"
        className="flex max-w-3xl items-center gap-2 text-sm leading-6 text-muted-foreground"
      >
        <Info className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
        <p className="m-0">{description}</p>
      </div>
    </div>
  );
}
