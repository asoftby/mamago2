import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import { formatPriceAmount, normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { cn } from "@/lib/utils";

/** The event publication price is the canonical presentation for public offers too. */
export function getPublicationPriceParts(value: string | null | undefined) {
  const normalized = normalizeUiCurrencyText(value);
  const match = normalized.match(/^(от\s+)?(\d[\d\s\u00a0]*(?:[.,]\d+)?)(?:\s*)(.*)$/i);
  if (!match) return { prefix: "", amount: normalized, suffix: "", numeric: false };
  const formatted = formatPriceAmount(match[2]);
  if (!formatted) return { prefix: "", amount: normalized, suffix: "", numeric: false };
  return { prefix: match[1]?.trim() ?? "", amount: formatted, suffix: match[3]?.trim() ?? "", numeric: true };
}

export function PublicationPriceDisplay({ label, className, showLabel = true, compactAmount = false }: {
  label: string | null | undefined;
  className?: string;
  showLabel?: boolean;
  compactAmount?: boolean;
}) {
  const price = getPublicationPriceParts(label);
  if (!price.amount) return null;
  return (
    <div className={cn("text-right", className)}>
      {showLabel && <div className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
        Стоимость
      </div>}
      <div className="flex items-baseline justify-end gap-1">
        {price.prefix && <span className="font-pt-serif text-[20px] font-normal leading-tight tracking-[-0.5px] text-[#141210]">{price.prefix}</span>}
        <span className={cn("font-pt-serif font-normal leading-tight text-[#141210]", price.numeric ? (compactAmount ? "text-[36px] tracking-[-1px]" : "text-[40px] tracking-[-1px]") : "text-[20px]")}>
          {price.amount}
        </span>
        {price.suffix && <span className="inline-flex items-center font-mono text-[13px] text-[rgba(20,18,16,0.55)]">
          {renderCurrencyText(price.suffix, { iconSize: "sm" })}
        </span>}
      </div>
    </div>
  );
}
