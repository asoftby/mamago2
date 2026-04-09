import Link from "next/link";
import { Cake } from "lucide-react";
import { cn } from "@/lib/utils";

type CityBirthdayCtaBlockProps = {
  /** Целевой сценарий дня рождения (публичный конструктор) */
  href?: string;
  className?: string;
};

export function CityBirthdayCtaBlock({
  href = "/birthday",
  className,
}: CityBirthdayCtaBlockProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-white",
        "p-5 sm:p-6 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EF8759]/15 text-[#EF8759]">
            <Cake className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-neutral-900 leading-tight">
              Организовать день рождения за 10 минут
            </h2>
            <p className="text-sm text-neutral-600 mt-1 leading-snug">
              Площадка, анимация, торт, декор и другие штуковины — в одном конструкторе легко и просто
            </p>
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex items-center justify-center rounded-xl bg-[#EF8759] text-white px-5 py-3 text-sm font-semibold hover:bg-[#e07848] transition-colors shrink-0 self-start sm:self-center"
        >
          Собрать праздник
        </Link>
      </div>
    </div>
  );
}
