"use client";

import Link from "next/link";
import { BookOpen, CalendarDays, Trash2, CalendarClock } from "lucide-react";
import { useOptionalCity } from "@/contexts/CityContext";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import { planEntryDisplay } from "../../lib/planEntryDisplay";
import type { PlanItemWithActivity } from "../../types/event";
import { PlanScreenHead } from "./PlanScreenHead";

export function planArticleHref(item: PlanItemWithActivity, fallbackCity: string): string | null {
  const slug = item.article?.slug?.trim();
  if (!slug) return null;
  return `/${item.article?.city?.slug ?? fallbackCity}/blog/${slug}`;
}

function formatReadDate(dateISO: string): string {
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
}

/** Экран статьи в модалке «Мой план»: рубрика, анонс, «Читать статью», перенос и удаление. */
export function PlanArticleScreen({
  item,
  onBack,
  onRemove,
  onMove,
  onNavigate,
}: {
  item: PlanItemWithActivity;
  onBack: () => void;
  onRemove: () => void;
  onMove?: () => void;
  onNavigate?: () => void;
}) {
  const cityCtx = useOptionalCity();
  const city = cityCtx?.citySlug ?? DEFAULT_CITY_SLUG;
  const { title, poster } = planEntryDisplay(item);
  const href = planArticleHref(item, city);
  const rubric = item.article?.category?.nameRu ?? null;
  const excerpt = item.article?.excerpt?.trim() || null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--mp-bg)]">
      <PlanScreenHead back="План" onBack={onBack} />
      <span className="mx-5 mb-3 inline-flex h-[30px] w-fit items-center rounded-full bg-[#E3ECDF] px-3 text-[13px] font-bold text-[#3D5A36] md:mx-8">
        Статья
      </span>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 md:px-8">
        {poster ? (
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl bg-[var(--mp-soft)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={poster} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}
        <h2 className="mp-font-display m-0 mt-[18px] text-[26px] font-normal leading-[1.18] tracking-[-0.015em] text-[var(--mp-tx)] [text-wrap:pretty]">
          {title}
        </h2>
        <div className="mx-0.5 mt-3.5 flex flex-col gap-3 text-[15.5px] leading-[1.35]">
          {rubric ? (
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-tx2)]">
                <BookOpen className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <b className="block font-bold text-[var(--mp-tx)]">Рубрика «{rubric}»</b>
              </span>
            </div>
          ) : null}
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-tx2)]">
              <CalendarDays className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <b className="block font-bold text-[var(--mp-tx)]">Прочитать {formatReadDate(item.date)}</b>
              <span className="mt-0.5 block text-[13.5px] text-[var(--mp-tx2)]">в любое время</span>
            </span>
          </div>
        </div>
        {excerpt ? (
          <p className="mx-0.5 mt-4 line-clamp-3 text-[15px] leading-[1.5] text-[var(--mp-tx)]/80">{excerpt}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2.5 border-t border-[var(--mp-line)] bg-[var(--mp-bg)] px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={onRemove}
          aria-label="Удалить из плана"
          title="Удалить из плана"
          className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[18px] border border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-ac-dark)] transition-colors hover:bg-[var(--mp-ac-soft)]"
        >
          <Trash2 className="h-[22px] w-[22px]" aria-hidden />
        </button>
        {onMove ? (
          <button
            type="button"
            onClick={onMove}
            aria-label="Перенести"
            title="Перенести"
            className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[18px] border border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-tx)] transition-colors hover:border-[var(--mp-line-strong)]"
          >
            <CalendarClock className="h-[22px] w-[22px]" aria-hidden />
          </button>
        ) : null}
        {href ? (
          <Link
            href={href}
            onClick={onNavigate}
            className="flex h-[58px] min-w-0 flex-1 items-center justify-center rounded-[18px] bg-[var(--mp-ac-dark)] px-3.5 text-[16.5px] font-bold text-white no-underline transition-colors hover:bg-[var(--mp-ac-dark)]/90 hover:text-white"
          >
            Читать статью
          </Link>
        ) : null}
      </div>
    </div>
  );
}
