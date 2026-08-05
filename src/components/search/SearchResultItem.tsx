"use client";

import { cn } from "@/lib/utils";
import type { SearchResultItem as SearchResultItemType } from "@/lib/search/types";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";

const TYPE_LABELS: Record<SearchResultItemType["type"], string> = {
  activity: "Событие",
  offer: "Предложение",
  place: "Место",
  route: "Маршрут",
  article: "Статья",
};

function highlightText(text: string, query: string) {
  const q = query.trim();
  if (q.length < 2) return text;
  const lower = text.toLowerCase();
  const qi = lower.indexOf(q.toLowerCase());
  if (qi < 0) return text;
  const before = text.slice(0, qi);
  const match = text.slice(qi, qi + q.length);
  const after = text.slice(qi + q.length);
  return (
    <>
      {before}
      <mark className="bg-amber-100/90 text-inherit">{match}</mark>
      {after}
    </>
  );
}

function MetaLine({ text }: { text: string }) {
  return (
    <p className="truncate text-xs text-neutral-500">
      {renderCurrencyText(normalizeUiCurrencyText(text), { iconSize: "sm" })}
    </p>
  );
}

export function SearchResultItem({
  item,
  query,
  active,
  onNavigate,
}: {
  item: SearchResultItemType;
  query: string;
  active?: boolean;
  onNavigate: () => void;
}) {
  const isActivity = item.type === "activity";
  const addressLine = isActivity ? item.summaryLine?.trim() || null : null;
  const detailLine = item.metaLine?.trim() || null;
  const fallbackSummary =
    !isActivity && item.summaryLine?.trim()
      ? item.summaryLine.trim()
      : TYPE_LABELS[item.type];

  return (
    <button
      type="button"
      onClick={onNavigate}
      className={cn(
        "flex w-full cursor-pointer gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
        "hover:bg-neutral-50",
        active && "bg-neutral-50",
      )}
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- динамические URL из каталога
          <img
            src={item.imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
            {TYPE_LABELS[item.type].slice(0, 1)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-semibold text-neutral-900">
          {highlightText(item.title, query)}
        </p>
        {isActivity ? (
          <>
            {addressLine ? (
              <p className="truncate text-xs text-muted-foreground">{addressLine}</p>
            ) : null}
            {detailLine ? <MetaLine text={detailLine} /> : null}
          </>
        ) : (
          <>
            <p className="line-clamp-2 text-xs text-muted-foreground">{fallbackSummary}</p>
            {detailLine ? <MetaLine text={detailLine} /> : null}
          </>
        )}
      </div>
    </button>
  );
}
