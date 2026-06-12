import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BYN_SYMBOL } from "@/lib/formatters/format-price";

interface BelarusianRubleIconProps {
  className?: string;
  size?: "default" | "sm" | "text" | "xs";
}

const ICON_SIZE = {
  default: { width: "0.81em", height: "1em", align: "-0.12em", translateY: undefined },
  /** Рядом с tabular-nums / font-bold (text-base) */
  text: { width: "0.56em", height: "0.7em", align: "-0.06em", translateY: undefined },
  /** Крупные суммы (text-3xl / text-4xl) */
  xs: { width: "0.5em", height: "0.62em", align: "-0.05em", translateY: undefined },
  sm: { width: "0.56em", height: "0.72em", align: "middle", translateY: "-0.03em" },
} as const;

/**
 * Официальный графический символ белорусского рубля (BYN).
 * Path извлечён напрямую из шрифта НБРБ (nbrb.ttf, glyphname "BYN", U+E901).
 * viewBox приведён к системе координат SVG (flip Y, origin в левом верхнем углу).
 * fill-rule="evenodd" обеспечивает правильное отверстие внутри контура.
 */
export function BelarusianRubleIcon({ className, size = "default" }: BelarusianRubleIconProps) {
  const dim = ICON_SIZE[size];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 945 1170"
      aria-label="бел. руб."
      role="img"
      className={cn("inline-block", className)}
      style={{
        width: dim.width,
        height: dim.height,
        verticalAlign: dim.align,
        transform: dim.translateY ? `translateY(${dim.translateY})` : undefined,
        flexShrink: 0,
      }}
      fill="currentColor"
    >
      {/* Outer contour + inner counter (hole) extracted from nbrb.ttf glyph "BYN" */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M945 826Q941 973 837 1070Q733 1167 578 1170H295H166V890H0V760H166V0H816V130H295V482H578Q733 486 837 583Q941 680 945 826ZM295 759H592V891H295V1041H579Q680 1039 748 977Q815 917 818 826Q815 734 747.5 673Q680 612 579 610H437H295Z"
      />
    </svg>
  );
}

/**
 * Заменяет U+E901 (символ BYN из шрифта nbrb) на SVG-иконку в строке.
 * Безопасно работает для строк без символа — возвращает строку as-is.
 */
export function renderPriceWithIcon(
  text: string,
  options?: { iconSize?: BelarusianRubleIconProps["size"] },
): ReactNode {
  if (!text) return null;
  const parts = text.split(BYN_SYMBOL);
  if (parts.length === 1) return text;
  const iconSize = options?.iconSize ?? "default";

  return (
    <span
      className={cn(
        "inline-flex gap-[0.18em] leading-none",
        iconSize === "text" || iconSize === "xs" ? "items-baseline" : "items-center align-middle",
      )}
    >
      {parts.flatMap((part, i) => {
        const nodes: ReactNode[] = part ? [<span key={`t${i}`}>{part}</span>] : [];
        if (i < parts.length - 1) {
          nodes.push(<BelarusianRubleIcon key={`r${i}`} size={iconSize} />);
        }
        return nodes;
      })}
    </span>
  );
}

export function renderCurrencyText(
  text: string | null | undefined,
  options?: { iconSize?: BelarusianRubleIconProps["size"] },
): ReactNode {
  if (!text) return null;
  return renderPriceWithIcon(text, options);
}
