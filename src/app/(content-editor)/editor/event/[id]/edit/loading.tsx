export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col bg-background animate-pulse">
      {/* Header skeleton */}
      <div className="border-b border-border bg-background px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-5 w-48 rounded bg-muted" />
        </div>
        <div className="h-8 w-24 rounded bg-muted" />
      </div>

      {/* Step segments skeleton */}
      <div className="border-b border-border bg-background px-6 py-3 flex gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-7 w-20 rounded-full bg-muted" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full space-y-6">
        <div className="h-6 w-40 rounded bg-muted" />
        <div className="space-y-3">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-10 w-full rounded-lg bg-muted" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-24 w-full rounded-lg bg-muted" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-28 rounded bg-muted" />
          <div className="h-10 w-full rounded-lg bg-muted" />
        </div>
      </div>

      {/* Action bar skeleton */}
      <div className="border-t border-border bg-background px-6 py-4 flex items-center justify-between">
        <div className="h-9 w-20 rounded-lg bg-muted" />
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-lg bg-muted" />
          <div className="h-9 w-32 rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
