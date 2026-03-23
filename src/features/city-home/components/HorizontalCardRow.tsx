import { cn } from "@/lib/utils";

type HorizontalCardRowProps = {
  children: React.ReactNode;
  className?: string;
  /** Доп. отступ снизу для тени скролла */
  padded?: boolean;
};

/**
 * Горизонтальный ряд карточек с нативным скроллом (паттерн как в Airbnb-лентах).
 */
export function HorizontalCardRow({
  children,
  className,
  padded = true,
}: HorizontalCardRowProps) {
  return (
    <div
      className={cn(
        "-mx-4 px-4 sm:mx-0 sm:px-0",
        padded && "pb-1",
      )}
    >
      <div
        className={cn(
          "flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory scroll-ps-4",
          className,
        )}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>
    </div>
  );
}
