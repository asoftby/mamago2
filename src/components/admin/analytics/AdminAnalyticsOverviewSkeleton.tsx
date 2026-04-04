/**
 * Плейсхолдеры Overview: KPI, воронка, график, топы (без данных).
 */
export function AdminAnalyticsOverviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Key metrics</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 h-3 w-24 rounded bg-muted/50 animate-pulse" />
              <div className="mb-1 h-8 w-20 rounded-md bg-muted/60 animate-pulse" />
              <div className="h-3 w-16 rounded bg-muted/40 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Funnel */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 h-5 w-40 rounded bg-muted/50 animate-pulse" />
          <div className="space-y-3">
            {[72, 58, 41, 28, 16].map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3 w-8 rounded bg-muted/30 animate-pulse" />
                <div
                  className="h-9 rounded-lg bg-muted/50 animate-pulse"
                  style={{ width: `${w}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 h-5 w-48 rounded bg-muted/50 animate-pulse" />
          <div className="flex aspect-[16/10] items-end justify-between gap-2 rounded-xl bg-muted/20 px-3 pb-2 pt-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-muted/50 animate-pulse"
                style={{ height: `${30 + ((i * 17) % 55)}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top segments */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 h-5 w-36 rounded bg-muted/50 animate-pulse" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 border-b border-gray-50 pb-3 last:border-0 last:pb-0"
              >
                <div className="h-4 flex-1 rounded bg-muted/45 animate-pulse" />
                <div className="h-4 w-14 rounded bg-muted/35 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Top content */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 h-5 w-40 rounded bg-muted/50 animate-pulse" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-gray-50 pb-3 last:border-0 last:pb-0"
              >
                <div className="h-10 w-10 shrink-0 rounded-lg bg-muted/50 animate-pulse" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-full max-w-[85%] rounded bg-muted/45 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-muted/35 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
