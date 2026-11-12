"use client";

import Link from "next/link";
import { useOptionalCity } from "@/contexts/CityContext";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import { planEntryDisplay } from "../../lib/planEntryDisplay";
import type { PlanItemWithActivity } from "../../types/event";
import { CatalogPreviewScreen, PREVIEW_PRIMARY, PreviewFooterButtons, type PreviewRow } from "../CatalogPreviewScreen";

export function planArticleHref(item: PlanItemWithActivity, fallbackCity: string): string | null {
  const slug = item.article?.slug?.trim();
  if (!slug) return null;
  return `/${item.article?.city?.slug ?? fallbackCity}/blog/${slug}`;
}

function formatReadDate(dateISO: string): string {
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
}

/** Экран статьи в модалке «Мой план»: рубрика, анонс, «Читать статью», перенос и удаление. Вёрстка — CatalogPreviewScreen. */
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
  const rows: PreviewRow[] = [];
  if (rubric) rows.push({ icon: "read", primary: `Рубрика «${rubric}»` });
  rows.push({ icon: "date", primary: `Прочитать ${formatReadDate(item.date)}`, secondary: "в любое время" });

  return (
    <CatalogPreviewScreen
      back="План"
      onBack={onBack}
      badge="Статья"
      tone="article"
      coverUrl={poster}
      coverMode="ifPresent"
      title={title}
      rows={rows}
      linkSlot={excerpt ? <p className="mx-0.5 mt-4 line-clamp-3 text-[15px] leading-[1.5] text-[var(--mp-tx)]/80">{excerpt}</p> : null}
      footer={
        <>
          <PreviewFooterButtons onRemove={onRemove} onMove={onMove} />
          {href ? (
            <Link href={href} onClick={onNavigate} className={PREVIEW_PRIMARY}>
              Читать статью
            </Link>
          ) : null}
        </>
      }
    />
  );
}
