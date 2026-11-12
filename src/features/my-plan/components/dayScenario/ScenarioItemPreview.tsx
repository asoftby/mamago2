"use client";

import { ArrowLeftRight, ExternalLink } from "lucide-react";
import { dayTitle, isoDateOf, itemHref, itemNotes, priceLabel, timeRange, type DraftItem } from "../../lib/dayScenarioUi/model";
import { CatalogPreviewScreen, PREVIEW_PRIMARY, PreviewFooterButtons, type PreviewRow } from "../CatalogPreviewScreen";
import { PLAN_FOCUS } from "../v3/planChipStyles";

/**
 * A point of the day without leaving the widget (the shared CatalogPreviewScreen, fed from the draft card).
 * Opened from a card of the day ("view": replace or remove it) and from an alternative of «Чем заменить?»
 * ("pick": take it). Everything shown is already in the draft, so opening it asks nothing from the server; the
 * public page is one tap away in a new tab, the draft stays here.
 */
export function ScenarioItemPreview({
  item,
  city,
  back,
  onBack,
  busy = false,
  onReplace,
  onRemove,
  onPick,
}: {
  item: DraftItem;
  city?: string;
  /** Label of the "‹" button: where it leads. */
  back: string;
  onBack: () => void;
  busy?: boolean;
  /** "view" actions. */
  onReplace?: () => void;
  onRemove?: () => void;
  /** "pick" action: take this point instead of the replaced one. */
  onPick?: () => void;
}) {
  const { card } = item;
  const href = itemHref(item, city);
  const price = priceLabel(card);
  const notes = itemNotes(item);
  const isEvent = item.kind === "event";
  const second = [card.categoryName, price].filter(Boolean).join(" · ");
  const rows: PreviewRow[] = [{ icon: "date", primary: `${dayTitle(isoDateOf(item.startsAt))} · ${timeRange(item.startsAt, item.endsAt)}`, secondary: second || undefined }];
  if (card.address) rows.push({ icon: "place", primary: card.address });

  return (
    <CatalogPreviewScreen
      back={back}
      onBack={onBack}
      badge={isEvent ? "Из афиши" : "Место"}
      tone={isEvent ? "event" : "place"}
      coverUrl={card.coverImageUrl}
      title={card.title}
      ageLabel={card.ageLabel}
      rows={rows}
      note={notes.length > 0 ? notes.join(" · ") : null}
      linkSlot={
        href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener"
            aria-label={`${isEvent ? "Открыть в афише" : "Открыть страницу места"} «${card.title}» (откроется в новой вкладке)`}
            className={`mx-auto mt-3.5 flex min-h-11 w-fit items-center gap-2 rounded-xl px-2.5 text-[15.5px] font-bold text-[var(--mp-ac-dark)] no-underline transition-colors hover:text-[var(--mp-ac)] ${PLAN_FOCUS}`}
          >
            <ExternalLink className="h-[17px] w-[17px]" aria-hidden />
            {isEvent ? "Открыть в афише" : "Страница места"}
          </a>
        ) : null
      }
      footer={
        onPick ? (
          <button type="button" onClick={onPick} className={PREVIEW_PRIMARY}>
            Выбрать это
          </button>
        ) : (
          <>
            <PreviewFooterButtons onRemove={onRemove} disabled={busy} removeLabel="Убрать из дня" />
            {onReplace ? (
              <button type="button" onClick={onReplace} disabled={busy} className={PREVIEW_PRIMARY}>
                <ArrowLeftRight className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                Заменить
              </button>
            ) : null}
          </>
        )
      }
    />
  );
}
