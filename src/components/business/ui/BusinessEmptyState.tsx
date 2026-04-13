import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BusinessSurfaceCard } from "./BusinessSurfaceCard";

interface BusinessEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryText?: string;
}

export function BusinessEmptyState({
  icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  secondaryText,
}: BusinessEmptyStateProps) {
  return (
    <BusinessSurfaceCard className="border-dashed border-stone-300/90 p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-stone-400">
        {icon}
      </div>
      <h3 className="mt-5 text-xl font-semibold tracking-tight text-stone-900">
        {title}
      </h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-stone-600">
        {description}
      </p>
      {ctaLabel && ctaHref ? (
        <div className="mt-7">
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 rounded-2xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
      {secondaryText ? (
        <p className="mt-4 text-xs leading-6 text-stone-500">{secondaryText}</p>
      ) : null}
    </BusinessSurfaceCard>
  );
}
