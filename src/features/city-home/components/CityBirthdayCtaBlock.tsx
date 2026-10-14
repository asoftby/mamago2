import Link from "next/link";
import { ArrowRight, Cake } from "lucide-react";
import { cn } from "@/lib/utils";
import { peachPrimaryCtaLinkClassName } from "@/lib/peachPrimaryCtaLink";
import { getBirthdayBuilderHref } from "@/lib/birthday/getBirthdayBuilderHref";

type CityBirthdayCtaBlockProps = {
  /** Целевой сценарий дня рождения (публичный конструктор) */
  href?: string;
  className?: string;
};

export function CityBirthdayCtaBlock({
  href = getBirthdayBuilderHref(),
  className,
}: CityBirthdayCtaBlockProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[34px] border border-primary/20",
        "bg-gradient-to-br from-primary/10 via-white to-primary/5",
        "px-6 py-6 shadow-[0_28px_70px_rgba(0,0,0,0.08)] sm:px-8 sm:py-7",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-40 bg-primary/10 blur-2xl" />
      <div className="pointer-events-none absolute -right-12 top-1/2 h-36 w-36 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-5">
          <div
            className={cn(
              "flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[21px]",
              "border border-primary/20 bg-primary/5 text-primary",
              "shadow-[inset_0_2px_3px_rgba(255,255,255,0.9)]",
            )}
          >
            <Cake className="h-[33px] w-[33px]" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="max-w-none text-[15px] tracking-[-0.04em] text-neutral-900 sm:leading-[1.1]" style={{ fontFamily: "var(--font-pt-serif)", fontWeight: 400, fontSize: 32 }}>
              Организовать День Рождения{" "}
              <em style={{ fontStyle: "italic", color: "var(--primary)", fontWeight: 400, fontFamily: "var(--font-editorial)", fontSize: 32, letterSpacing: "-0.5px" }}>за <span style={{ fontFamily: "var(--font-display)" }}>10</span> минут</em>
            </h2>
            <p className="mt-3 max-w-2xl text-[14px] leading-[150%] text-neutral-600 sm:text-[14px]">
              Площадка, анимация, торт, декор и другие штуковины — в одном конструкторе легко и просто
            </p>
          </div>
        </div>
        <Link
          href={href}
          className={peachPrimaryCtaLinkClassName("self-start sm:min-w-[240px] sm:self-center")}
        >
          Собрать праздник
          <ArrowRight
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 sm:h-[18px] sm:w-[18px]"
            aria-hidden
          />
        </Link>
      </div>
    </div>
  );
}
