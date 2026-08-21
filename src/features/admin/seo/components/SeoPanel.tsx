"use client";

import { useEffect, useMemo, useRef } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/hooks/use-hydrated";
import { sameOriginUrl } from "@/lib/client/sameOriginUrl";
import { stripHtml, truncateSeoText } from "@/lib/publications/breakingNewsSeo";
import { cn } from "@/lib/utils";

const SEO_TITLE_LIMIT = 60;
const SEO_DESCRIPTION_LIMIT = 160;
const SEO_TITLE_MIN = 40;
const SEO_DESCRIPTION_MIN = 120;

function normalizePlainText(value: string | null | undefined): string {
  return stripHtml(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeUrl(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function samePathAndSearch(left: string, right: string): boolean {
  try {
    const base = "https://placeholder.invalid";
    const a = new URL(left, base);
    const b = new URL(right, base);
    return a.pathname === b.pathname && a.search === b.search;
  } catch {
    return false;
  }
}

function toSnippetUrl(value: string | undefined, fallbackUrl: string): string {
  const trimmed = value?.trim();
  return trimmed || fallbackUrl;
}

function CharCounter({
  value,
  limit,
  recommendedMin,
}: {
  value: string;
  limit: number;
  recommendedMin: number;
}) {
  const length = value.length;
  const isTooLong = length > limit;
  const isSoftWarning = length > 0 && (length < recommendedMin || length >= limit * 0.9);

  return (
    <span
      className={cn(
        "shrink-0 text-xs tabular-nums",
        isTooLong
          ? "font-semibold text-red-600"
          : isSoftWarning
            ? "text-amber-600"
            : "text-muted-foreground",
      )}
    >
      {length} / {limit}
    </span>
  );
}

function FieldHint({
  value,
  fallbackLabel,
  recommendedMin,
  limit,
}: {
  value: string;
  fallbackLabel: string;
  recommendedMin: number;
  limit: number;
}) {
  const length = value.length;

  if (!length) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        Если поле оставить пустым, будет использован {fallbackLabel}.
      </p>
    );
  }

  if (length > limit) {
    return (
      <p className="text-xs leading-relaxed text-red-600">
        Получилось длиннее рекомендованного лимита. Лучше сократить формулировку.
      </p>
    );
  }

  if (length < recommendedMin) {
    return (
      <p className="text-xs leading-relaxed text-amber-700">
        Короткий текст допустим, но обычно лучше работает более развёрнутый вариант.
      </p>
    );
  }

  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      Рекомендованный диапазон: {recommendedMin}–{limit} символов.
    </p>
  );
}

export interface SeoPanelProps {
  entityKey?: string;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  noindex: boolean;
  coverImageUrl?: string | null;
  fallbackTitle?: string;
  fallbackDescription?: string;
  publicUrl?: string;
  cityName?: string;
  entityType?: string;
  disabled?: boolean;
  onSeoTitleChange: (value: string) => void;
  onSeoDescriptionChange: (value: string) => void;
  onCanonicalUrlChange: (value: string) => void;
  onNoindexChange: (value: boolean) => void;
  onAutofillSeo?: () => void;
  /** Отключить встроенный auto-fill — когда родитель сам синхронизирует поля. */
  disableAutoFill?: boolean;
}

export function SeoPanel({
  entityKey,
  seoTitle,
  seoDescription,
  canonicalUrl,
  noindex,
  coverImageUrl,
  fallbackTitle,
  fallbackDescription,
  publicUrl,
  cityName,
  entityType,
  disabled = false,
  onSeoTitleChange,
  onSeoDescriptionChange,
  onCanonicalUrlChange,
  onNoindexChange,
  onAutofillSeo,
  disableAutoFill = false,
}: SeoPanelProps) {
  void coverImageUrl;
  const hydrated = useHydrated();
  const normalizedFallbackTitle = useMemo(
    () => truncateSeoText(normalizePlainText(fallbackTitle), SEO_TITLE_LIMIT),
    [fallbackTitle],
  );
  const normalizedFallbackDescription = useMemo(
    () => truncateSeoText(normalizePlainText(fallbackDescription), SEO_DESCRIPTION_LIMIT),
    [fallbackDescription],
  );
  const normalizedPublicUrl = useMemo(() => {
    const raw = normalizeUrl(publicUrl);
    return hydrated && raw ? sameOriginUrl(raw) : raw;
  }, [hydrated, publicUrl]);

  const previousAutoTitleRef = useRef(normalizedFallbackTitle);
  const previousAutoDescriptionRef = useRef(normalizedFallbackDescription);
  const previousAutoCanonicalRef = useRef(normalizedPublicUrl);
  const manualTitleRef = useRef(Boolean(seoTitle.trim()));
  const manualDescriptionRef = useRef(Boolean(seoDescription.trim()));
  const manualCanonicalRef = useRef(Boolean(canonicalUrl.trim()));

  useEffect(() => {
    manualTitleRef.current = Boolean(seoTitle.trim());
    manualDescriptionRef.current = Boolean(seoDescription.trim());
    manualCanonicalRef.current = Boolean(canonicalUrl.trim());
    previousAutoTitleRef.current = normalizedFallbackTitle;
    previousAutoDescriptionRef.current = normalizedFallbackDescription;
    previousAutoCanonicalRef.current = normalizedPublicUrl;
  }, [entityKey, normalizedFallbackTitle, normalizedFallbackDescription, normalizedPublicUrl, seoTitle, seoDescription, canonicalUrl]);

  useEffect(() => {
    if (disableAutoFill) return;
    const current = seoTitle.trim();
    const previousAuto = previousAutoTitleRef.current.trim();
    if (!manualTitleRef.current && (!current || current === previousAuto) && normalizedFallbackTitle) {
      onSeoTitleChange(normalizedFallbackTitle);
    }
    previousAutoTitleRef.current = normalizedFallbackTitle;
  }, [disableAutoFill, normalizedFallbackTitle, onSeoTitleChange, seoTitle]);

  useEffect(() => {
    if (disableAutoFill) return;
    const current = seoDescription.trim();
    const previousAuto = previousAutoDescriptionRef.current.trim();
    if (
      !manualDescriptionRef.current &&
      (!current || current === previousAuto) &&
      normalizedFallbackDescription
    ) {
      onSeoDescriptionChange(normalizedFallbackDescription);
    }
    previousAutoDescriptionRef.current = normalizedFallbackDescription;
  }, [disableAutoFill, normalizedFallbackDescription, onSeoDescriptionChange, seoDescription]);

  useEffect(() => {
    if (!hydrated || disableAutoFill) return;
    const current = canonicalUrl.trim();
    const previousAuto = previousAutoCanonicalRef.current.trim();
    if (!manualCanonicalRef.current && (!current || current === previousAuto) && normalizedPublicUrl) {
      onCanonicalUrlChange(normalizedPublicUrl);
    }
    previousAutoCanonicalRef.current = normalizedPublicUrl;
  }, [canonicalUrl, disableAutoFill, hydrated, normalizedPublicUrl, onCanonicalUrlChange]);

  useEffect(() => {
    if (!hydrated || !normalizedPublicUrl) return;
    const current = canonicalUrl.trim();
    if (!current || !samePathAndSearch(current, normalizedPublicUrl)) return;
    const rebased = sameOriginUrl(current);
    if (rebased !== current) {
      onCanonicalUrlChange(rebased);
    }
  }, [canonicalUrl, hydrated, normalizedPublicUrl, onCanonicalUrlChange]);

  const effectiveTitle = seoTitle.trim() || normalizedFallbackTitle || "Заголовок материала — mamaGo";
  const effectiveDescription =
    seoDescription.trim() ||
    normalizedFallbackDescription ||
    "Краткое описание материала появится здесь.";
  const canonicalTrimmed = canonicalUrl.trim();
  const effectiveCanonical =
    hydrated && canonicalTrimmed && normalizedPublicUrl && samePathAndSearch(canonicalTrimmed, normalizedPublicUrl)
      ? sameOriginUrl(canonicalTrimmed)
      : canonicalTrimmed || normalizedPublicUrl;
  const snippetFallbackUrl = hydrated ? sameOriginUrl("/...") : "/...";
  const canonicalPlaceholder =
    normalizedPublicUrl || (hydrated ? sameOriginUrl("/blog/slug") : "/blog/slug");
  const hasAutofillSource =
    Boolean(normalizedFallbackTitle) ||
    Boolean(normalizedFallbackDescription) ||
    Boolean(normalizedPublicUrl);
  const hasEmptyAutofillTargets =
    (!seoTitle.trim() && Boolean(normalizedFallbackTitle)) ||
    (!seoDescription.trim() && Boolean(normalizedFallbackDescription)) ||
    (!canonicalUrl.trim() && Boolean(normalizedPublicUrl));

  const handleAutofill = () => {
    if (!seoTitle.trim() && normalizedFallbackTitle) {
      manualTitleRef.current = false;
      onSeoTitleChange(normalizedFallbackTitle);
    }
    if (!seoDescription.trim() && normalizedFallbackDescription) {
      manualDescriptionRef.current = false;
      onSeoDescriptionChange(normalizedFallbackDescription);
    }
    if (!canonicalUrl.trim() && normalizedPublicUrl) {
      manualCanonicalRef.current = false;
      onCanonicalUrlChange(normalizedPublicUrl);
    }
    onAutofillSeo?.();
  };

  return (
    <Card className="overflow-hidden rounded-2xl border-gray-200 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">SEO</CardTitle>
            <CardDescription>
              Картинка для соцсетей и мессенджеров использует обложку материала, как в превью.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutofill}
            disabled={disabled || !hasAutofillSource || !hasEmptyAutofillTargets}
          >
            <Sparkles className="mr-1.5 h-4 w-4" aria-hidden />
            Заполнить из материала
          </Button>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Google snippet
          </p>
          <p className="truncate text-xs text-[#006621]">
            {toSnippetUrl(effectiveCanonical || undefined, snippetFallbackUrl)}
          </p>
          <p className="mt-1 truncate text-lg font-medium leading-snug text-[#1a0dab]">
            {effectiveTitle}
          </p>
          <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-gray-700">
            {effectiveDescription}
          </p>
        </div>
        {noindex ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <p className="text-xs leading-relaxed text-amber-900">
              Материал помечен как noindex и не будет индексироваться поисковыми системами.
            </p>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="seo-title">SEO title</Label>
            <CharCounter value={seoTitle} limit={SEO_TITLE_LIMIT} recommendedMin={SEO_TITLE_MIN} />
          </div>
          <Input
            id="seo-title"
            value={seoTitle}
            onChange={(event) => {
              manualTitleRef.current = event.target.value.trim().length > 0;
              onSeoTitleChange(event.target.value);
            }}
            disabled={disabled}
            placeholder={normalizedFallbackTitle || "Будет использован основной заголовок материала"}
          />
          <FieldHint
            value={seoTitle}
            fallbackLabel="основной заголовок материала"
            recommendedMin={SEO_TITLE_MIN}
            limit={SEO_TITLE_LIMIT}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="seo-description">SEO description</Label>
            <CharCounter
              value={seoDescription}
              limit={SEO_DESCRIPTION_LIMIT}
              recommendedMin={SEO_DESCRIPTION_MIN}
            />
          </div>
          <Textarea
            id="seo-description"
            rows={4}
            value={seoDescription}
            onChange={(event) => {
              manualDescriptionRef.current = event.target.value.trim().length > 0;
              onSeoDescriptionChange(event.target.value);
            }}
            disabled={disabled}
            placeholder={
              normalizedFallbackDescription || "Будет использовано описание или лид материала"
            }
          />
          <FieldHint
            value={seoDescription}
            fallbackLabel="описание или лид материала"
            recommendedMin={SEO_DESCRIPTION_MIN}
            limit={SEO_DESCRIPTION_LIMIT}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="seo-canonical">Canonical URL</Label>
          <Input
            id="seo-canonical"
            value={canonicalUrl}
            onChange={(event) => {
              manualCanonicalRef.current = event.target.value.trim().length > 0;
              onCanonicalUrlChange(event.target.value);
            }}
            disabled={disabled}
            placeholder={canonicalPlaceholder}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Поле не обязательно. Если оставить пустым, публичная страница использует свой canonical URL по умолчанию.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="seo-noindex" className="text-primary">
              Скрыть от поисковых систем
            </Label>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Материал не будет индексироваться Google и не появится в поисковой выдаче.
            </p>
            {(cityName || entityType) && (
              <p className="text-xs text-muted-foreground">
                {cityName ? cityName : entityType}
              </p>
            )}
          </div>
          <Switch
            id="seo-noindex"
            checked={noindex}
            onCheckedChange={(checked) => onNoindexChange(checked === true)}
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
