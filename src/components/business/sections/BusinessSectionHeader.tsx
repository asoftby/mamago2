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
    <BusinessSurfaceCard className="relative overflow-hidden px-6 py-6 md:px-7 md:py-7">
      <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(251,191,36,0.08)_0%,rgba(255,255,255,0)_100%)]" />
      <div className="relative flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
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
        <div
          role="note"
          className="flex max-w-3xl items-start gap-2.5 rounded-2xl border border-sky-200/80 bg-sky-50/70 px-3.5 py-3 text-sm leading-6 text-stone-700"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700/80" aria-hidden />
          <p className="m-0">{description}</p>
        </div>
      </div>
    </BusinessSurfaceCard>
  );
}
