import { DISCOVERY_TABLE, DISCOVERY_TABLE_WRAP } from "./discoveryTaxonomyClasses";

export function DiscoveryTaxonomyTable({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={DISCOVERY_TABLE_WRAP}>
      <table className={DISCOVERY_TABLE}>{children}</table>
    </div>
  );
}
