import { TableContainer } from "@/components/ui/table";
import { DISCOVERY_TABLE, DISCOVERY_TABLE_WRAP } from "./discoveryTaxonomyClasses";

export function DiscoveryTaxonomyTable({
  children,
  minWidthClassName = "min-w-[720px]",
  scrollLabel = "Таблица таксономии, прокручивается по горизонтали",
}: {
  children: React.ReactNode;
  /** Осознанная минимальная ширина таблицы — переопределить для таблиц с 8+ колонками. */
  minWidthClassName?: string;
  scrollLabel?: string;
}) {
  return (
    <div className={DISCOVERY_TABLE_WRAP}>
      <TableContainer minWidthClassName={minWidthClassName} scrollLabel={scrollLabel}>
        <table className={DISCOVERY_TABLE}>{children}</table>
      </TableContainer>
    </div>
  );
}
