"use client";

import type { PublicationStatsHeaderMeta } from "@/lib/publication-stats/types";

export function PublicationStatsHeader({
  header,
  periodLabelRu,
  statsUpdatedAtDisplay,
}: {
  header: PublicationStatsHeaderMeta;
  /** Текущий выбранный период (синхрон с переключателем) */
  periodLabelRu: string;
  /** Показ времени обновления; при refetch можно передать предыдущее значение */
  statsUpdatedAtDisplay: string;
}) {
  return (
    <div className="min-w-0 space-y-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
        publication.stats
      </p>
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <p>
          <span className="text-muted-foreground/80">тип:</span>{" "}
          <span className="text-foreground/80">{header.entityTypeLabel}</span>
        </p>
        <p>
          <span className="text-muted-foreground/80">роль:</span>{" "}
          <span className="text-foreground/80">{header.viewerRoleLabel}</span>
        </p>
        <p>
          <span className="text-muted-foreground/80">период:</span>{" "}
          <span className="text-foreground/80">{periodLabelRu}</span>
        </p>
        <p>
          <span className="text-muted-foreground/80">обновлено:</span>{" "}
          <span className="text-foreground/80">{statsUpdatedAtDisplay}</span>
        </p>
        <p className="sm:col-span-2">
          <span className="text-muted-foreground/80">id:</span>{" "}
          <span className="break-all text-foreground/80">{header.publicationId}</span>
        </p>
        <p className="sm:col-span-2">
          <span className="text-muted-foreground/80">path:</span>{" "}
          <span className="break-all text-foreground/80">{header.path}</span>
        </p>
      </div>
    </div>
  );
}
