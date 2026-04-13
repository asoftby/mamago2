import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";

interface BusinessSectionHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}

export function BusinessSectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: BusinessSectionHeaderProps) {
  return (
    <BusinessSurfaceCard className="relative overflow-hidden px-6 py-6 md:px-7 md:py-7">
      <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(251,191,36,0.08)_0%,rgba(255,255,255,0)_100%)]" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl space-y-2">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950 md:text-[2rem]">
            {title}
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-stone-600">
            {description}
          </p>
        </div>
      </div>
        {actions ? <div className="relative shrink-0">{actions}</div> : null}
      </div>
    </BusinessSurfaceCard>
  );
}
