"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PUBLICATION_STATS_PERIOD,
  PUBLICATION_STATS_PERIOD_LABEL_RU,
  type PublicationStatsPeriod,
} from "@/lib/publication-stats/period";
import type { PublicationStatsPayload } from "@/lib/publication-stats/types";
import { canViewPublicationStatsClient } from "@/lib/publication-stats/visibility";
import { PublicationStatsHeader } from "./PublicationStatsHeader";
import { PublicationStatsPeriodSwitch } from "./PublicationStatsPeriodSwitch";
import { PublicationStatsSections } from "./PublicationStatsSections";

type MeResponse = { role?: string };

type Access = "unknown" | "denied" | "allowed";

function PublicationStatsLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-2 font-mono text-xs text-muted-foreground/50">
      <div className="h-3 w-1/3 rounded bg-muted" />
      <div className="h-3 w-2/3 rounded bg-muted" />
      <div className="h-3 w-1/2 rounded bg-muted" />
      <div className="h-3 w-full rounded bg-muted" />
    </div>
  );
}

function formatUpdatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/**
 * Технический блок publication.stats внизу страницы события.
 * Гости и пользователи без прав — блок не монтируется (без лишнего flash).
 */
export function PublicationStatsPanel({
  entityId,
  path,
}: {
  entityId: string;
  path: string;
}) {
  const [access, setAccess] = useState<Access>("unknown");
  const [period, setPeriod] = useState<PublicationStatsPeriod>(
    DEFAULT_PUBLICATION_STATS_PERIOD
  );
  const [data, setData] = useState<PublicationStatsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      if (cancelled) return;
      if (!meRes.ok) {
        setAccess("denied");
        return;
      }
      const me = (await meRes.json()) as MeResponse;
      setAccess(canViewPublicationStatsClient(me.role) ? "allowed" : "denied");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (access !== "allowed") return;
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ path, period });
        const statsRes = await fetch(
          `/api/publication-stats/${encodeURIComponent(entityId)}?${qs.toString()}`,
          { credentials: "include" }
        );
        if (cancelled) return;

        if (statsRes.status === 401 || statsRes.status === 403) {
          setAccess("denied");
          return;
        }

        if (!statsRes.ok) {
          const err = await statsRes.json().catch(() => ({}));
          setError(
            typeof err?.error === "string" ? err.error : `HTTP ${statsRes.status}`
          );
          return;
        }

        const json = (await statsRes.json()) as PublicationStatsPayload;
        setData(json);
      } catch {
        if (!cancelled) setError("Сеть недоступна");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [access, entityId, path, period]);

  if (access === "unknown" || access === "denied") {
    return null;
  }

  if (error && !data) {
    return (
      <div className="mt-10 border-t border-border/40 bg-muted/15">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-4">
          <p className="font-mono text-xs text-muted-foreground">
            publication.stats — ошибка загрузки: {error}
          </p>
        </div>
      </div>
    );
  }

  if (!data && loading) {
    return (
      <div className="mt-10 border-t border-border/40 bg-muted/20">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-6">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/60">
            publication.stats
          </p>
          <PublicationStatsLoadingSkeleton />
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div
      className="mt-10 border-t border-border/40 bg-muted/20"
      data-publication-stats-panel
      aria-label="Техническая статистика публикации"
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <PublicationStatsHeader
            header={data.header}
            periodLabelRu={PUBLICATION_STATS_PERIOD_LABEL_RU[period]}
            statsUpdatedAtDisplay={
              loading ? "…" : formatUpdatedAt(data.header.statsUpdatedAt)
            }
          />
          <PublicationStatsPeriodSwitch
            value={period}
            onChange={setPeriod}
            disabled={loading}
            className="shrink-0 lg:max-w-[min(100%,520px)]"
          />
        </div>

        <div
          className={cn("relative mt-5", loading && "opacity-50")}
          aria-busy={loading}
        >
          {loading ? (
            <p className="mb-2 text-[10px] font-mono text-muted-foreground/70">
              обновление…
            </p>
          ) : null}
          <PublicationStatsSections payload={data} />
        </div>

        {error && data ? (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            предупреждение: {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
