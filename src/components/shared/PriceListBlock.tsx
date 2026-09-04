import type { PriceItem } from "@/lib/priceItems";
import { BYN_SYMBOL, normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { BelarusianRubleIcon, renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import { extractPlainTextLinesFromHtml } from "@/lib/richtext/utils";

interface PriceListBlockProps {
  items: PriceItem[];
  /** Rich-text details from the main Event price editor. */
  detailsHtml?: string;
  note?: string;
  updatedAt?: Date | string | null;
  /** Внутренний заголовок "Сколько стоит / N позиций". Скрывается, когда его уже даёт секция-обёртка. */
  showHeader?: boolean;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function renderNote(text: string): React.ReactNode {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let bullets: string[] = [];

  function flushBullets() {
    if (bullets.length === 0) return;
    result.push(
      <ul key={result.length} className="list-disc pl-4 space-y-0.5">
        {bullets.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  }

  for (const line of lines) {
    if (line.startsWith("- ")) {
      bullets.push(line.slice(2));
    } else {
      flushBullets();
      if (line.trim() === "") {
        if (result.length > 0) result.push(<div key={result.length} className="h-1.5" />);
      } else {
        result.push(<p key={result.length}>{renderInline(line)}</p>);
      }
    }
  }
  flushBullets();
  return result;
}

function priceAmountText(raw: string): string {
  return normalizeUiCurrencyText(raw).replaceAll(BYN_SYMBOL, "").trim();
}

export function PriceListBlock({
  items,
  detailsHtml,
  note,
  updatedAt,
  showHeader = true,
}: PriceListBlockProps) {
  const detailsLines = detailsHtml?.trim()
    ? extractPlainTextLinesFromHtml(detailsHtml)
    : [];

  if (items.length === 0 && detailsLines.length === 0 && !note?.trim()) return null;

  const dateLabel = updatedAt
    ? new Date(updatedAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="my-8 rounded-xl border border-[rgba(20,18,16,0.14)] overflow-hidden bg-white">
      {showHeader && (
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#FAF7F1] border-b border-[rgba(20,18,16,0.10)]">
          <span
            className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]"
            style={{ fontFamily: "Menlo, monospace" }}
          >
            Сколько стоит
          </span>
          <span className="text-xs text-[rgba(20,18,16,0.55)]" style={{ fontFamily: "Menlo, monospace" }}>
            {items.length} позиций
          </span>
        </div>
      )}

      {detailsLines.length > 0 && (
        <div className="border-b border-[rgba(20,18,16,0.08)] px-5 py-4">
          <div className="space-y-2 text-[15px] leading-relaxed text-[#141210]">
            {detailsLines.map((line, index) => (
              <p key={`${index}-${line.slice(0, 24)}`}>
                {renderCurrencyText(normalizeUiCurrencyText(line), { iconSize: "sm" })}
              </p>
            ))}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="divide-y divide-[rgba(20,18,16,0.08)]">
          {items.map((item, index) => {
            const amount = priceAmountText(item.price);
            const showCurrency = Boolean(amount) && /\d/.test(amount);

            return (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="w-4 shrink-0 text-xs text-[rgba(20,18,16,0.45)]">{index + 1}.</span>
                <span className="min-w-0 flex-1 text-sm leading-snug text-[#141210]">{item.label}</span>
                <span className="ml-auto inline-flex min-w-[88px] shrink-0 items-baseline justify-end gap-1 whitespace-nowrap pl-3">
                  <span className="font-pt-serif text-[28px] font-normal leading-none tracking-[-0.5px] text-[#141210] tabular-nums">
                    {amount}
                  </span>
                  {showCurrency && (
                    <span
                      className="inline-flex items-center text-[13px] text-[rgba(20,18,16,0.55)]"
                      aria-label="Белорусский рубль"
                    >
                      <BelarusianRubleIcon size="sm" />
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {note?.trim() ? (
        <div className="px-5 py-3 border-t border-[rgba(20,18,16,0.08)]">
          <div className="text-sm text-[rgba(20,18,16,0.65)] leading-relaxed space-y-1">
            {renderNote(note.trim())}
          </div>
        </div>
      ) : null}
      {dateLabel && (
        <div className="px-5 py-2.5 bg-[#FAF7F1]/60 border-t border-[rgba(20,18,16,0.06)]">
          <span className="text-[11px] text-[rgba(20,18,16,0.45)]">Обновлено: {dateLabel}</span>
        </div>
      )}
    </div>
  );
}
