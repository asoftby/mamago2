"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type ScrollEdge = "none" | "left" | "right" | "both";

/**
 * Единая обёртка для горизонтального скролла таблиц (Стратегия A из аудита
 * адаптивности). Скроллится только содержимое таблицы, а не вся страница;
 * градиенты по краям и (опционально) текстовая подсказка появляются только
 * когда контент реально не помещается по ширине.
 */
export interface TableContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Класс с осознанной минимальной шириной таблицы, например "min-w-[720px]". */
  minWidthClassName?: string;
  /** aria-label скроллящегося региона. */
  scrollLabel?: string;
  /** Отключить градиенты-индикаторы скролла по краям. */
  hideScrollShadow?: boolean;
  /** Текст подсказки снизу ("Прокрутите вправо…"), показывается только когда есть overflow вправо. */
  scrollHintMessage?: string;
}

export const TableContainer = React.forwardRef<HTMLDivElement, TableContainerProps>(
  (
    {
      className,
      minWidthClassName,
      scrollLabel = "Таблица, прокручивается по горизонтали",
      hideScrollShadow,
      scrollHintMessage,
      children,
      ...props
    },
    ref,
  ) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [edge, setEdge] = React.useState<ScrollEdge>("none");

    React.useEffect(() => {
      const el = scrollRef.current;
      if (!el) {
        setEdge("none");
        return;
      }

      const update = () => {
        const { scrollLeft, scrollWidth, clientWidth } = el;
        const overflow = scrollWidth > clientWidth + 2;
        if (!overflow) {
          setEdge("none");
          return;
        }
        const atStart = scrollLeft <= 2;
        const atEnd = scrollLeft + clientWidth >= scrollWidth - 2;
        if (atStart && !atEnd) setEdge("right");
        else if (!atStart && atEnd) setEdge("left");
        else if (!atStart && !atEnd) setEdge("both");
        else setEdge("none");
      };

      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      el.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      return () => {
        ro.disconnect();
        el.removeEventListener("scroll", update);
        window.removeEventListener("resize", update);
      };
      // Пересчитываем при смене содержимого (другая длина списка/страница).
    }, [children]);

    const showLeftShadow = !hideScrollShadow && (edge === "left" || edge === "both");
    const showRightShadow = !hideScrollShadow && (edge === "right" || edge === "both");
    const showHint = Boolean(scrollHintMessage) && (edge === "right" || edge === "both");

    return (
      <div className={cn("relative min-w-0 max-w-full", className)} {...props}>
        {showLeftShadow && (
          <div
            className="pointer-events-none absolute left-0 top-0 z-30 h-full w-8 bg-gradient-to-r from-white to-transparent"
            aria-hidden
          />
        )}
        {showRightShadow && (
          <div
            className="pointer-events-none absolute right-0 top-0 z-30 h-full w-8 bg-gradient-to-l from-white to-transparent"
            aria-hidden
          />
        )}
        <div
          ref={(node) => {
            scrollRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          role="region"
          aria-label={scrollLabel}
          tabIndex={0}
          className="max-w-full min-w-0 overflow-x-auto overscroll-x-contain motion-safe:scroll-smooth [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-inset"
        >
          <div className={cn(minWidthClassName)}>{children}</div>
        </div>
        {showHint && (
          <div
            className="flex items-center justify-center gap-2 border-t border-amber-100 bg-amber-50/80 px-3 py-2 text-center text-xs text-amber-950"
            role="status"
          >
            <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span>{scrollHintMessage}</span>
          </div>
        )}
      </div>
    );
  },
);
TableContainer.displayName = "TableContainer";

/** Класс для обёртки border+rounded вокруг TableContainer — типовой вид карточки-таблицы в проекте. */
export const TABLE_CARD_WRAP = "border border-gray-200 rounded-lg bg-white overflow-hidden";

/** Sticky-колонки: применять только когда это реально необходимо (много колонок + важно видеть действия/первую колонку). */
export const stickyFirstColumnHeadClass =
  "sticky left-0 z-20 bg-gray-50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]";
export const stickyFirstColumnCellClass =
  "sticky left-0 z-10 bg-white group-hover:bg-gray-50 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)]";
export const stickyActionColumnHeadClass =
  "sticky right-0 z-20 bg-gray-50 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]";
export const stickyActionColumnCellClass =
  "sticky right-0 z-10 bg-white group-hover:bg-gray-50 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)]";

/* ------------------------------------------------------------------------ */
/* Семантические примитивы таблицы — для нового кода. Существующие таблицы  */
/* можно оставить как есть и только обернуть их в TableContainer.           */
/* ------------------------------------------------------------------------ */

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  containerProps?: Omit<TableContainerProps, "children">;
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerProps, children, ...props }, ref) => (
    <TableContainer {...containerProps}>
      <table ref={ref} className={cn("w-full text-sm", className)} {...props}>
        {children}
      </table>
    </TableContainer>
  ),
);
Table.displayName = "Table";

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("bg-gray-50 border-b border-gray-200", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("divide-y divide-gray-200", className)} {...props} />
));
TableBody.displayName = "TableBody";

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot ref={ref} className={cn("border-t border-gray-200 bg-gray-50", className)} {...props} />
));
TableFooter.displayName = "TableFooter";

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn("group hover:bg-gray-50", className)} {...props} />
  ),
);
TableRow.displayName = "TableRow";

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn("px-4 py-3 text-left align-middle font-medium text-gray-700", className)}
    {...props}
  />
));
TableHead.displayName = "TableHead";

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("px-4 py-3 align-middle text-gray-600", className)} {...props} />
));
TableCell.displayName = "TableCell";

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-2 text-sm text-gray-500", className)} {...props} />
));
TableCaption.displayName = "TableCaption";
