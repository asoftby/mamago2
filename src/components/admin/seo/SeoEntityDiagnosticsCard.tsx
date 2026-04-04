import type { SeoPageEntityDiagnostics } from "@/lib/admin/seo/domain/types";
import {
  SEO_ROBOTS_INDEX_FOLLOW,
  SEO_ROBOTS_NOINDEX_FOLLOW,
} from "@/lib/admin/seo/entities/robotsConstants";
import {
  computeSeoEditorCanonicalLive,
  resolveSeoPublicBase,
} from "@/lib/admin/seo/seoEditorCanonical";
import { cn } from "@/lib/utils";

function absFromPath(publicPath: string): string | null {
  if (typeof window === "undefined") return null;
  return `${window.location.origin}${publicPath}`;
}

function formatRobotsDisplay(raw: string | null | undefined): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "—";
  if (s.includes("noindex")) return SEO_ROBOTS_NOINDEX_FOLLOW;
  return SEO_ROBOTS_INDEX_FOLLOW;
}

/** Один источник для редактора: черновик canonical = вручную, иначе из БД. */
function canonicalSourceAutoManual(
  d: SeoPageEntityDiagnostics,
  canonicalDraftTrim: string,
): "Авто" | "Вручную" {
  if (canonicalDraftTrim.length > 0) return "Вручную";
  if (d.seoCanonicalSource === "MANUAL") return "Вручную";
  return "Авто";
}

function formatStatus(raw: string): string {
  const s = raw.trim();
  if (!s) return "—";
  if (s === "PUBLISHED") return "Опубликовано";
  if (s === "DRAFT") return "Черновик";
  if (s === "PENDING") return "На модерации";
  if (s === "NEEDS_REVISION") return "Нужны правки";
  if (s === "DELETED") return "Удалено";
  if (s.includes("/")) {
    const [a, b] = s.split("/");
    const map: Record<string, string> = {
      PUBLISHED: "Опубликовано",
      DRAFT: "Черновик",
      PUBLIC: "публичный",
      PRIVATE: "приватный",
      ARCHIVED: "архив",
    };
    return [map[a] ?? a, map[b ?? ""] ?? b].filter(Boolean).join(" · ");
  }
  return s;
}

export function SeoEntityDiagnosticsCard({
  d,
  variant = "full",
  canonicalUrl,
  canonicalDraft,
}: {
  d: SeoPageEntityDiagnostics;
  variant?: "full" | "compact";
  /** Сохранённый canonical со списка SEO-страниц */
  canonicalUrl?: string | null;
  /** Черновик поля Canonical в SEO-редакторе (если задан — считаем effective от него) */
  canonicalDraft?: string | null;
}) {
  const abs = d.absolutePublicUrl ?? absFromPath(d.publicPath);
  const draftForLive =
    canonicalDraft !== undefined ? (canonicalDraft ?? "") : (canonicalUrl ?? "");
  const draftTrim = draftForLive.trim();
  const live = computeSeoEditorCanonicalLive(d, draftForLive, resolveSeoPublicBase());
  const showLiveIdWarning =
    live.canonicalUsesIdInsteadOfSlug &&
    !d.issues.some((m) => /id в пути|id вместо slug/i.test(m));
  const hasIssues = d.issues.length > 0 || showLiveIdWarning;

  const sourceLabel = canonicalSourceAutoManual(d, draftTrim);

  return (
    <div
      className={cn(
        "rounded-lg border text-left",
        hasIssues
          ? "border-amber-200/90 bg-amber-50/70"
          : "border-gray-200/90 bg-white",
        variant === "compact" ? "p-2.5" : "p-3",
      )}
    >
      <div
        className={cn(
          "font-medium text-gray-900",
          variant === "compact" ? "text-xs" : "text-sm",
        )}
      >
        Диагностика URL / slug
      </div>

      {hasIssues ? (
        <ul
          className={cn(
            "mt-1.5 list-disc space-y-0.5 pl-3.5 text-amber-950",
            variant === "compact" ? "text-[11px]" : "text-xs",
          )}
        >
          {d.issues.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
          {showLiveIdWarning ? (
            <li key="canonical-id-warning">Canonical указывает на id вместо slug</li>
          ) : null}
        </ul>
      ) : (
        <p
          className={cn(
            "mt-1 text-emerald-800/90",
            variant === "compact" ? "text-[11px]" : "text-xs",
          )}
        >
          Конфликтов не видно.
        </p>
      )}

      <dl
        className={cn(
          "mt-2.5 space-y-2 text-gray-800",
          variant === "compact" ? "text-[11px]" : "text-xs",
        )}
      >
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
          <dt className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-500">
            Slug
          </dt>
          <dd className="min-w-0 break-all font-mono text-gray-900">
            {d.slug?.trim() ? d.slug : "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
          <dt className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-500">
            Public URL
          </dt>
          <dd className="min-w-0 break-all font-mono text-gray-900">
            {abs ?? "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
          <dt className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-500">
            Canonical (effective)
          </dt>
          <dd className="min-w-0 break-all font-mono text-gray-900">
            {live.effectiveCanonicalAbsolute ?? "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
          <dt className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-500">
            Canonical source
          </dt>
          <dd className="text-gray-900">{sourceLabel}</dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
          <dt className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-500">
            Canonical matches public URL?
          </dt>
          <dd className="font-medium text-gray-900">
            {live.canonicalMatchesPublicUrl === "yes" ? "yes" : "no"}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
          <dt className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-500">
            Robots
          </dt>
          <dd className="font-mono text-gray-900">{formatRobotsDisplay(d.seoRobots)}</dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
          <dt className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-500">
            Статус
          </dt>
          <dd className="text-gray-900">{formatStatus(d.contentStatus)}</dd>
        </div>
      </dl>
    </div>
  );
}
