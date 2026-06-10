import { cn } from "@/lib/utils";
import { BelarusianRubleIcon } from "@/components/icons/BelarusianRubleIcon";
import { formatPriceAmount } from "@/lib/formatters/format-price";

interface PriceProps {
  /** Числовое или строковое значение суммы. null/undefined → компонент не рендерится. */
  value: number | string | null | undefined;
  className?: string;
}

/**
 * Отображает цену с официальным SVG-символом белорусского рубля.
 *
 * @example
 *   <Price value={15} />     // «15,00 [SVG-символ]»
 *   <Price value={15.5} />   // «15,50 [SVG-символ]»
 *   <Price value={null} />   // ничего не рендерится
 */
export function Price({ value, className }: PriceProps) {
  const formatted = formatPriceAmount(value);
  if (!formatted) return null;

  return (
    <span className={cn("inline-flex items-baseline gap-[0.18em]", className)}>
      <span>{formatted}</span>
      <BelarusianRubleIcon />
    </span>
  );
}
