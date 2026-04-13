import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BusinessSectionHeader } from "./BusinessSectionHeader";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";

type PlaceholderLink = {
  label: string;
  href: string;
};

export function BusinessPlaceholderPage(props: {
  eyebrow?: string;
  title: string;
  description: string;
  summary: string;
  nextActionLabel: string;
  nextActionHref: string;
  bullets: string[];
  secondaryLinks?: PlaceholderLink[];
}) {
  const {
    eyebrow,
    title,
    description,
    summary,
    nextActionLabel,
    nextActionHref,
    bullets,
    secondaryLinks = [],
  } = props;

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

      <section className="grid gap-6 lg:grid-cols-[1.25fr_0.9fr]">
        <BusinessSurfaceCard className="p-6 md:p-7">
          <p className="text-sm leading-7 text-stone-700">{summary}</p>
          <ul className="mt-5 space-y-3 text-sm text-stone-600">
            {bullets.map((bullet) => (
              <li key={bullet} className="rounded-[22px] border border-stone-200/80 bg-stone-50/80 px-4 py-3 leading-7">
                {bullet}
              </li>
            ))}
          </ul>
        </BusinessSurfaceCard>

        <BusinessSurfaceCard tone="dark" className="p-6 md:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
            Next step
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            {nextActionLabel}
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/75">
            Раздел уже встроен в новую структуру кабинета. Здесь пока нет тяжёлого функционала,
            но переход и сценарий для бизнеса остаются понятными и рабочими.
          </p>

          <Link
            href={nextActionHref}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-stone-950 transition hover:bg-stone-100"
          >
            {nextActionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>

          {secondaryLinks.length > 0 ? (
            <div className="mt-6 space-y-2 border-t border-white/10 pt-4">
              {secondaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-sm text-white/80 transition hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
        </BusinessSurfaceCard>
      </section>
    </div>
  );
}
