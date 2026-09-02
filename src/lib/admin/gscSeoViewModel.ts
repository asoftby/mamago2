function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function relativeChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export interface GscPageMoverViewModel {
  page: string;
  deltaClicks: number;
}

export interface GscSeoViewModel {
  clicks: number | null;
  clicksChangePercent: number | null;
  impressions: number | null;
  impressionsChangePercent: number | null;
  ctr: number | null;
  ctrDeltaPp: number | null;
  position: number | null;
  positionDelta: number | null;
  rising: GscPageMoverViewModel[];
  falling: GscPageMoverViewModel[];
}

function readMovers(value: unknown): { rising: GscPageMoverViewModel[]; falling: GscPageMoverViewModel[] } {
  if (!value || typeof value !== "object") return { rising: [], falling: [] };
  const source = value as { rising?: unknown; falling?: unknown };
  const parse = (rows: unknown): GscPageMoverViewModel[] => {
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const item = row as { page?: unknown; deltaClicks?: unknown };
      if (typeof item.page !== "string" || typeof item.deltaClicks !== "number" || !Number.isFinite(item.deltaClicks)) {
        return [];
      }
      return [{ page: item.page, deltaClicks: item.deltaClicks }];
    });
  };
  return { rising: parse(source.rising), falling: parse(source.falling) };
}

export function deriveGscSeo(kpis: Record<string, unknown>): GscSeoViewModel {
  const clicks = readNumber(kpis["gsc.clicks_7d"]);
  const clicksPrev = readNumber(kpis["gsc.clicks_prev_7d"]);
  const impressions = readNumber(kpis["gsc.impressions_7d"]);
  const impressionsPrev = readNumber(kpis["gsc.impressions_prev_7d"]);
  const rawCtr = readNumber(kpis["gsc.ctr_7d"]);
  const rawCtrPrev = readNumber(kpis["gsc.ctr_prev_7d"]);
  const rawPosition = readNumber(kpis["gsc.position_7d"]);
  const rawPositionPrev = readNumber(kpis["gsc.position_prev_7d"]);
  const movers = readMovers(kpis["gsc.page_movers"]);

  const ctr = impressions !== null && impressions > 0 ? rawCtr : null;
  const ctrPrev = impressionsPrev !== null && impressionsPrev > 0 ? rawCtrPrev : null;
  const position = impressions !== null && impressions > 0 ? rawPosition : null;
  const positionPrev = impressionsPrev !== null && impressionsPrev > 0 ? rawPositionPrev : null;

  return {
    clicks,
    clicksChangePercent: relativeChange(clicks, clicksPrev),
    impressions,
    impressionsChangePercent: relativeChange(impressions, impressionsPrev),
    ctr,
    ctrDeltaPp: ctr !== null && ctrPrev !== null ? Math.round((ctr - ctrPrev) * 1000) / 10 : null,
    position,
    // Negative is an improvement because lower GSC position is better.
    positionDelta:
      position !== null && positionPrev !== null ? Math.round((position - positionPrev) * 10) / 10 : null,
    rising: movers.rising,
    falling: movers.falling,
  };
}
