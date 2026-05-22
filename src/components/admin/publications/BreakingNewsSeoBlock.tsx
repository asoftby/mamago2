"use client";

import { useEffect, useMemo } from "react";
import { AlertTriangle, Info, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  SEO_TITLE_LIMIT,
  SEO_DESC_LIMIT,
  generateBreakingNewsSeoTitle,
  generateBreakingNewsSeoDescription,
  buildBreakingNewsCanonicalUrl,
} from "@/lib/publications/breakingNewsSeo";

// Use the same env var the rest of the editor uses
const PUBLIC_BASE = (
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL) ||
  "https://mamago.by"
).replace(/\/+$/, "");

// ─── Character counter ────────────────────────────────────────────────────────

function CharCounter({ value, limit }: { value: string; limit: number }) {
  const len = value.length;
  const ratio = len / limit;
  return (
    <span
      className={cn(
        "text-xs tabular-nums shrink-0",
        ratio > 1
          ? "text-red-600 font-semibold"
          : ratio > 0.9
            ? "text-amber-600"
            : "text-muted-foreground",
      )}
    >
      {len} / {limit}
    </span>
  );
}

// ─── Snippet preview ──────────────────────────────────────────────────────────

function SnippetPreview({
  title,
  url,
  description,
  noindex,
}: {
  title: string;
  url: string;
  description: string;
  noindex: boolean;
}) {
  if (noindex) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <p className="text-xs leading-snug text-amber-800">
          Предпросмотр скрыт: новость помечена как noindex и не появится в поиске.
        </p>
      </div>
    );
  }

  const displayTitle = title || "Заголовок новости — mamaGo";
  const displayUrl = url || `${PUBLIC_BASE}/blog/…`;
  const displayDesc = description || "Краткое описание новости появится здесь.";

  return (
    <div className="space-y-1 rounded-lg border border-gray-200 bg-white px-3 py-3">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Предпросмотр в поиске
      </p>
      {/* Title row */}
      <p className="truncate text-sm font-medium leading-snug text-[#1a0dab]">
        {displayTitle}
      </p>
      {/* URL row */}
      <p className="truncate text-xs text-[#006621]">{displayUrl}</p>
      {/* Description */}
      <p className="line-clamp-2 text-xs leading-relaxed text-gray-700">{displayDesc}</p>
    </div>
  );
}

// ─── Reset-to-auto button ─────────────────────────────────────────────────────

function AutoLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-muted-foreground underline decoration-dashed underline-offset-2 hover:text-foreground"
    >
      ← авто
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface BreakingNewsSeoBlockProps {
  /** Article title — source for auto SEO title */
  title: string;
  /** Article slug — source for auto canonical URL */
  slug: string;
  /** Article body HTML — source for auto SEO description */
  bodyHtml: string;

  /** Controlled SEO field values */
  seoTitle: string;
  seoDescription: string;
  seoCanonicalUrl: string;
  noindex: boolean;

  /**
   * Dirty flags — true means the user (or a DB load of a non-empty value)
   * has explicitly set this field; auto-fill is suppressed.
   */
  seoTitleTouched: boolean;
  seoDescTouched: boolean;
  canonicalManual: boolean;

  /** Value setters */
  onSeoTitleChange: (v: string) => void;
  onSeoDescChange: (v: string) => void;
  onSeoCanonicalChange: (v: string) => void;
  onNoindexChange: (v: boolean) => void;

  /** Dirty-flag setters */
  onSeoTitleTouched: (touched: boolean) => void;
  onSeoDescTouched: (touched: boolean) => void;
  onCanonicalManualChange: (manual: boolean) => void;

  disabled?: boolean;
}

export function BreakingNewsSeoBlock({
  title,
  slug,
  bodyHtml,
  seoTitle,
  seoDescription,
  seoCanonicalUrl,
  noindex,
  seoTitleTouched,
  seoDescTouched,
  canonicalManual,
  onSeoTitleChange,
  onSeoDescChange,
  onSeoCanonicalChange,
  onNoindexChange,
  onSeoTitleTouched,
  onSeoDescTouched,
  onCanonicalManualChange,
  disabled = false,
}: BreakingNewsSeoBlockProps) {
  // Auto-generated values (memoised to avoid recalculating on every render)
  const autoTitle = useMemo(() => generateBreakingNewsSeoTitle(title), [title]);
  const autoDesc = useMemo(
    () => generateBreakingNewsSeoDescription(bodyHtml, title),
    [bodyHtml, title],
  );
  const autoCanonical = useMemo(
    () => buildBreakingNewsCanonicalUrl(slug, PUBLIC_BASE),
    [slug],
  );

  // ── Auto-fill effects ─────────────────────────────────────────────────────
  // Each effect runs when the source data changes, but only writes when the
  // field has not been manually touched.

  useEffect(() => {
    if (seoTitleTouched) return;
    onSeoTitleChange(autoTitle);
  }, [autoTitle, seoTitleTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (seoDescTouched) return;
    onSeoDescChange(autoDesc);
  }, [autoDesc, seoDescTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (canonicalManual) return;
    onSeoCanonicalChange(autoCanonical);
  }, [autoCanonical, canonicalManual]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effective display values ──────────────────────────────────────────────
  const effectiveTitle = seoTitle || autoTitle;
  const effectiveDesc = seoDescription || autoDesc;
  const effectiveCanonical = canonicalManual ? seoCanonicalUrl : autoCanonical;

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleTitleChange(v: string) {
    onSeoTitleTouched(true);
    onSeoTitleChange(v);
  }
  function handleTitleReset() {
    onSeoTitleTouched(false);
    onSeoTitleChange(autoTitle);
  }

  function handleDescChange(v: string) {
    onSeoDescTouched(true);
    onSeoDescChange(v);
  }
  function handleDescReset() {
    onSeoDescTouched(false);
    onSeoDescChange(autoDesc);
  }

  function handleCanonicalOverride() {
    onCanonicalManualChange(true);
  }
  function handleCanonicalReset() {
    onCanonicalManualChange(false);
    onSeoCanonicalChange(autoCanonical);
  }

  return (
    <div className="space-y-5">
      {/* ── Snippet preview ── */}
      <SnippetPreview
        title={effectiveTitle}
        url={effectiveCanonical}
        description={effectiveDesc}
        noindex={noindex}
      />

      {/* ── SEO title ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm">SEO title</Label>
          <div className="flex items-center gap-3">
            {seoTitleTouched && <AutoLink onClick={handleTitleReset} />}
            <CharCounter value={seoTitle} limit={SEO_TITLE_LIMIT} />
          </div>
        </div>
        <Input
          value={seoTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          disabled={disabled}
          placeholder={autoTitle || "Заголовок — mamaGo"}
          className={cn(
            seoTitle.length > SEO_TITLE_LIMIT &&
              "border-red-400 focus-visible:ring-red-400",
          )}
        />
        {!seoTitleTouched && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Info className="h-3 w-3 shrink-0" aria-hidden />
            Заполняется автоматически из заголовка новости
          </p>
        )}
      </div>

      {/* ── SEO description ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm">SEO description</Label>
          <div className="flex items-center gap-3">
            {seoDescTouched && <AutoLink onClick={handleDescReset} />}
            <CharCounter value={seoDescription} limit={SEO_DESC_LIMIT} />
          </div>
        </div>
        <Textarea
          rows={3}
          value={seoDescription}
          onChange={(e) => handleDescChange(e.target.value)}
          disabled={disabled}
          placeholder={autoDesc || "Краткое описание для поиска"}
          className={cn(
            "resize-y min-h-[72px]",
            seoDescription.length > SEO_DESC_LIMIT &&
              "border-red-400 focus-visible:ring-red-400",
          )}
        />
        {!seoDescTouched && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Info className="h-3 w-3 shrink-0" aria-hidden />
            Заполняется автоматически из текста новости
          </p>
        )}
      </div>

      {/* ── Canonical URL ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm">Canonical URL</Label>
          {canonicalManual ? (
            <AutoLink onClick={handleCanonicalReset} />
          ) : (
            <button
              type="button"
              onClick={handleCanonicalOverride}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" aria-hidden />
              Изменить вручную
            </button>
          )}
        </div>
        {canonicalManual ? (
          <Input
            value={seoCanonicalUrl}
            onChange={(e) => onSeoCanonicalChange(e.target.value)}
            disabled={disabled}
            placeholder="https://mamago.by/blog/moy-slug"
            className="font-mono text-xs"
          />
        ) : (
          <p className="break-all rounded-md border border-border/40 bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">
            {autoCanonical || "Будет сгенерирован после ввода slug"}
          </p>
        )}
      </div>

      {/* ── noindex switcher ── */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="breaking-noindex" className="text-primary">
            Не индексировать новость
          </Label>
          <p className="text-xs leading-snug text-muted-foreground">
            Новость не будет индексироваться Google и не появится в поисковой выдаче.
          </p>
        </div>
        <Switch
          id="breaking-noindex"
          checked={noindex}
          onCheckedChange={(c) => onNoindexChange(c === true)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
