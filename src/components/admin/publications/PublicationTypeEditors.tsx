"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ContentStatus, type GeoScope } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { ActivityCardEntityPicker } from "@/components/admin/articles/ActivityCardEntityPicker";
import { ArticleBlockRichEditor } from "@/components/admin/articles/ArticleBlockRichEditor";
import { ArticleEditorCoverField } from "@/components/admin/articles/ArticleEditorCoverField";
import { ArticleEditorGalleryField } from "@/components/admin/articles/ArticleEditorGalleryField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PublicationStatus } from "@/lib/publications/domain";
import type { ArticleEditorSnapshot } from "@/lib/article/articleAdminTypes";
import { buildEmptyBreakingNewsEditorSnapshot } from "@/lib/article/articleEditorEmptySnapshots";
import type { ArticleBlockEntityType } from "@/lib/publications/articleMvp";
import type { BreakingNewsFormState } from "@/lib/publications/breakingNewsArticle";
import {
  breakingNewsStateToArticleSaveInput,
  fromLocalDatetimeValue,
  isBreakingNewsSnapshot,
  parseBreakingNewsFromSnapshot,
} from "@/lib/publications/breakingNewsArticle";
import { PublicationPanel } from "@/components/admin/articles/PublicationPanel";
import { ArticleBlocksEditor, ArticleTocToggle } from "@/components/admin/publications/ArticleBlocksEditor";
import { useUnsavedChangesNavigationGuard } from "@/hooks/use-unsaved-changes-navigation-guard";
import { PlaceLinkedContactsEditor } from "@/components/admin/publications/PlaceLinkedContactsEditor";
import { PlaceLinkedPricesEditor } from "@/components/admin/publications/PlaceLinkedPricesEditor";
import { createClientSavePerf } from "@/lib/perf/clientSavePerf";
import { SeoPanel } from "@/features/admin/seo/components/SeoPanel";
import { resolveSeoPublicBase } from "@/lib/admin/seo/seoEditorCanonical";
import {
  generateBreakingNewsSeoDescription,
  generateBreakingNewsSeoTitle,
} from "@/lib/publications/breakingNewsSeo";
import { buildArticlePublicPath } from "@/lib/routing/cityPaths";
import { usePublicationSlugField } from "@/hooks/usePublicationSlugField";
import { PublicationSlugField } from "@/components/admin/publications/PublicationSlugField";
import { useHydrated } from "@/hooks/use-hydrated";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { validateArticleGeoScope } from "@/lib/article/articleGeoScopeValidation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


function newsEditorSnapshotComparable(args: {
  title: string;
  slug: string;
  coverImageId: string;
  galleryIds: string[];
  bodyHtml: string;
  pricingHtml: string;
  linkedEntityType: ArticleBlockEntityType;
  linkedEntityId: string;
  status: ContentStatus;
  scheduledAtLocal: string;
  publishedAtLocal: string;
  seoTitle: string;
  seoDescription: string;
  seoCanonicalUrl: string;
  noindex: boolean;
  authorUserId: string | null;
  geoScope: GeoScope | null;
  cityId: string | null;
}): string {
  return JSON.stringify(args);
}

export function NewsPublicationEditor({
  articleId,
  title,
  onTitleChange,
}: {
  /** `null` — черновик в БД не создан, первая запись по «Сохранить» / «Опубликовать». */
  articleId: string | null;
  title: string;
  onTitleChange: (value: string) => void;
}) {
  const router = useRouter();
  const hasPersistedId = Boolean(articleId?.trim());
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(() =>
    articleId ? "loading" : "ready",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notBreakingWarning, setNotBreakingWarning] = useState(false);
  const [coverImageId, setCoverImageId] = useState("");
  const [galleryIds, setGalleryIds] = useState<string[]>([]);
  const [slug, setSlug] = useState("");
  const [pinnedSlug, setPinnedSlug] = useState<string | null>(null);
  const [bodyHtml, setBodyHtml] = useState("");
  const [pricingHtml, setPricingHtml] = useState("");
  const [linkedEntityType, setLinkedEntityType] = useState<ArticleBlockEntityType>("PLACE");
  const [linkedEntityId, setLinkedEntityId] = useState("");
  const [status, setStatus] = useState<ContentStatus>("DRAFT");
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [publishedAtLocal, setPublishedAtLocal] = useState("");
  const [views, setViews] = useState(0);
  const [isAdminEditor, setIsAdminEditor] = useState(true);
  const [actionsBusy, setActionsBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moderating, setModerating] = useState(false);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoCanonicalUrl, setSeoCanonicalUrl] = useState("");
  const [noindex, setNoindex] = useState(false);
  const [coverImagePreviewUrl, setCoverImagePreviewUrl] = useState("");
  const [authorUserId, setAuthorUserId] = useState<string | null>(null);
  const [authorError, setAuthorError] = useState<string | null>(null);
  const [geoScope, setGeoScope] = useState<GeoScope | null>(null);
  const [cityId, setCityId] = useState<string | null>(null);
  const [geoScopeError, setGeoScopeError] = useState<string | null>(null);
  const [cities, setCities] = useState<{ id: string; name: string; slug: string }[]>([]);

  const hydrated = useHydrated();

  const [savedComparable, setSavedComparable] = useState<string | null>(null);

  const formState = useMemo(
    (): BreakingNewsFormState => ({
      title,
      slug,
      coverImageId,
      galleryIds,
      bodyHtml,
      pricingHtml,
      linkedEntityType,
      linkedEntityId,
      status,
      scheduledAtLocal,
      publishedAtLocal,
      seoTitle,
      seoDescription,
      seoCanonicalUrl,
      noindex,
      authorUserId,
      geoScope,
      cityId,
    }),
    [
      title,
      slug,
      coverImageId,
      galleryIds,
      bodyHtml,
      pricingHtml,
      linkedEntityType,
      linkedEntityId,
      status,
      scheduledAtLocal,
      publishedAtLocal,
      seoTitle,
      seoDescription,
      seoCanonicalUrl,
      noindex,
      authorUserId,
      geoScope,
      cityId,
    ],
  );

  const currentComparable = useMemo(
    () => newsEditorSnapshotComparable(formState),
    [formState],
  );

  const dirty =
    savedComparable !== null && loadState === "ready" && currentComparable !== savedComparable;

  const { leaveDialogOpen, confirmLeave, onLeaveDialogOpenChange } = useUnsavedChangesNavigationGuard(dirty);

  const applySnapshot = useCallback(
    (snap: ArticleEditorSnapshot) => {
      const p = parseBreakingNewsFromSnapshot(snap);
      onTitleChange(p.title);
      setSlug(p.slug);
      setPinnedSlug(snap.slug?.trim() || null);
      setCoverImageId(p.coverImageId);
      setCoverImagePreviewUrl(snap.coverImageUrl ?? "");
      setGalleryIds(p.galleryIds);
      setBodyHtml(p.bodyHtml);
      setPricingHtml(p.pricingHtml);
      setLinkedEntityType(p.linkedEntityType);
      setLinkedEntityId(p.linkedEntityId);
      setStatus(p.status);
      setScheduledAtLocal(p.scheduledAtLocal);
      setPublishedAtLocal(p.publishedAtLocal);
      setSeoTitle(p.seoTitle);
      setSeoDescription(p.seoDescription);
      setSeoCanonicalUrl(p.seoCanonicalUrl);
      setNoindex(p.noindex);
      setAuthorUserId(p.authorUserId);
      setAuthorError(null);
      setGeoScope(p.geoScope);
      setCityId(p.cityId);
      setGeoScopeError(null);
      setViews(snap.views);
      setSavedComparable(newsEditorSnapshotComparable(p));
    },
    [onTitleChange],
  );

  useEffect(() => {
    if (!articleId) {
      setLoadError(null);
      const empty = buildEmptyBreakingNewsEditorSnapshot();
      applySnapshot(empty);
      setNotBreakingWarning(false);
      setLoadState("ready");
      return;
    }
    let cancelled = false;
    setLoadState("loading");
    setLoadError(null);
    (async () => {
      const res = await fetch(`/api/admin/articles/${articleId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (!cancelled) {
          setLoadError(
            typeof err.error === "string"
              ? err.error
              : "Не удалось загрузить черновик",
          );
          setLoadState("error");
        }
        return;
      }
      const snap = (await res.json()) as ArticleEditorSnapshot;
      if (cancelled) return;
      setNotBreakingWarning(!isBreakingNewsSnapshot(snap));
      applySnapshot(snap);
      setLoadState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [articleId, applySnapshot]);

  // Load city list for the city selector (same endpoint as ArticleEditorClient).
  // For brand-new breaking news (articleId === null) auto-default to CITY + Minsk so editors
  // don't accidentally publish a local story as a national item. Existing articles keep their
  // stored geoScope/cityId because applySnapshot runs after this and overwrites the defaults.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/articles/editor-options");
      if (!res.ok || cancelled) return;
      const data = (await res.json().catch(() => null)) as {
        cities?: { id: string; name: string; slug: string }[];
      } | null;
      if (!data || cancelled) return;
      setCities(data.cities ?? []);
      if (!articleId) {
        // Only set the default when geoScope is still null (unset by the empty snapshot).
        // The functional-update form prevents overwriting a geoScope that was already set.
        const minsk = data.cities?.find((c) => c.slug === "minsk");
        if (minsk) {
          setGeoScope((prev) => (prev === null ? "CITY" : prev));
          setCityId((prev) => (prev === null ? minsk.id : prev));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [articleId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return;
      const u = (await res.json().catch(() => null)) as { id?: string; role?: string } | null;
      if (!cancelled && u?.role) {
        setIsAdminEditor(u.role === "ADMIN");
      }
      // Auto-populate author with current user only for brand-new (unsaved) articles.
      if (!cancelled && u?.id && !articleId) {
        setAuthorUserId((prev) => prev ?? u.id ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  const breakingNewsRequestBody = useCallback(() => {
    const input = breakingNewsStateToArticleSaveInput(formState, {
      publishedAtIso: fromLocalDatetimeValue(publishedAtLocal),
      scheduledAtIso: fromLocalDatetimeValue(scheduledAtLocal),
    });
    return {
      title: input.title,
      slug: input.slug,
      subtitle: input.subtitle,
      excerpt: input.excerpt,
      content: input.content,
      coverImageId: input.coverImageId,
      authorLabel: input.authorLabel,
      authorUserId: input.authorUserId,
      cityContext: input.cityContext,
      geoScope: input.geoScope,
      cityId: input.cityId,
      status: input.status,
      publishedAt: input.publishedAt,
      scheduledAt: input.scheduledAt,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      seoCanonicalUrl: input.seoCanonicalUrl,
      seoOgTitle: input.seoOgTitle,
      seoOgDescription: input.seoOgDescription,
      seoRobots: input.seoRobots,
      noindex: input.noindex,
    };
  }, [formState, publishedAtLocal, scheduledAtLocal]);

  const saveArticle = useCallback(
    async (opts?: { silent?: boolean; skipLoading?: boolean }): Promise<boolean> => {
      if (!opts?.skipLoading) {
        setSaving(true);
        setActionsBusy(true);
      }
      try {
        const body = breakingNewsRequestBody();
        if (!hasPersistedId) {
          const perf = createClientSavePerf("save-article:client", {
            endpoint: "/api/admin/articles",
            payload: body,
          });
          const res = await fetch("/api/admin/articles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          perf.log({ status: res.status, mode: "create-draft" });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            const msg =
              typeof data.error === "string"
                ? data.error
                : (data as { message?: string }).message || "Не удалось сохранить черновик";
            toast.error(msg);
            return false;
          }
          const snap = data as ArticleEditorSnapshot;
          applySnapshot(snap);
          if (!opts?.silent) {
            toast.success("Черновик сохранён");
          }
          router.replace(`/admin/content/publications/new?type=news&id=${encodeURIComponent(snap.id)}`);
          return true;
        }

        const perf = createClientSavePerf("save-article:client", {
          endpoint: `/api/admin/articles/${articleId}`,
          payload: body,
        });
        const res = await fetch(`/api/admin/articles/${articleId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        perf.log({ status: res.status, mode: "save-draft" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : (data as { message?: string }).message || "Не удалось сохранить черновик";
          toast.error(msg);
          return false;
        }
        const snap = data as ArticleEditorSnapshot;
        applySnapshot(snap);
        if (!opts?.silent) {
          toast.success("Черновик сохранён");
        }
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
        return false;
      } finally {
        if (!opts?.skipLoading) {
          setSaving(false);
          setActionsBusy(false);
        }
      }
    },
    [hasPersistedId, articleId, applySnapshot, breakingNewsRequestBody, router],
  );

  const saveDraft = () => void saveArticle();

  const submitForModeration = async () => {
    // Validate author before publishing / submitting for moderation.
    if (!authorUserId) {
      setAuthorError("Выберите автора публикации");
      return;
    }
    setAuthorError(null);
    // Validate geo scope before publishing.
    const geoValidation = validateArticleGeoScope({ geoScope, cityId, strict: true });
    if (!geoValidation.ok) {
      setGeoScopeError(geoValidation.message);
      return;
    }
    setGeoScopeError(null);
    setSubmitting(true);
    setActionsBusy(true);
    try {
      let id = articleId?.trim() ?? "";
      if (!id) {
        const body = breakingNewsRequestBody();
        const perf = createClientSavePerf("save-article:client", {
          endpoint: "/api/admin/articles",
          payload: body,
        });
        const res = await fetch("/api/admin/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        perf.log({ status: res.status, mode: "create-before-submit" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : (data as { message?: string }).message || "Не удалось создать публикацию";
          toast.error(msg);
          return;
        }
        const created = data as ArticleEditorSnapshot;
        id = created.id;
        applySnapshot(created);
      } else {
        const ok = await saveArticle({ silent: true, skipLoading: true });
        if (!ok) return;
      }

      const submitPerf = createClientSavePerf("publish-article:client", {
        endpoint: isAdminEditor
          ? `/api/admin/articles/${id}/moderate`
          : `/api/admin/articles/${id}/submit`,
        payload: isAdminEditor ? { decision: "publish" } : undefined,
      });
      const res = isAdminEditor
        ? await fetch(`/api/admin/articles/${id}/moderate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision: "publish" }),
          })
        : await fetch(`/api/admin/articles/${id}/submit`, { method: "POST" });
      submitPerf.log({ status: res.status, mode: isAdminEditor ? "publish" : "submit" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : isAdminEditor
              ? "Не удалось опубликовать"
              : "Не удалось отправить на модерацию";
        toast.error(msg);
        return;
      }
      if (data && typeof data === "object" && "id" in data) {
        applySnapshot(data as ArticleEditorSnapshot);
      }
      toast.success(isAdminEditor ? "Опубликовано" : "Отправлено на модерацию");
      router.replace(`/admin/content/publications/new?type=news&id=${encodeURIComponent(id)}`);
    } finally {
      setSubmitting(false);
      setActionsBusy(false);
    }
  };

  const moderate = async (action: "publish" | "reject") => {
    if (action === "publish" && !authorUserId) {
      setAuthorError("Выберите автора публикации");
      return;
    }
    setAuthorError(null);
    if (action === "publish") {
      const geoValidation = validateArticleGeoScope({ geoScope, cityId, strict: true });
      if (!geoValidation.ok) {
        setGeoScopeError(geoValidation.message);
        return;
      }
      setGeoScopeError(null);
    }
    setModerating(true);
    setActionsBusy(true);
    try {
      let id = articleId?.trim() ?? "";
      if (!id) {
        const body = breakingNewsRequestBody();
        const perf = createClientSavePerf("save-article:client", {
          endpoint: "/api/admin/articles",
          payload: body,
        });
        const res = await fetch("/api/admin/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        perf.log({ status: res.status, mode: "create-before-moderate" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "Не удалось создать публикацию");
          return;
        }
        const created = data as ArticleEditorSnapshot;
        id = created.id;
        applySnapshot(created);
      } else {
        const ok = await saveArticle({ silent: true, skipLoading: true });
        if (!ok) return;
      }

      const moderatePerf = createClientSavePerf("publish-article:client", {
        endpoint: `/api/admin/articles/${id}/moderate`,
        payload: { decision: action },
      });
      const res = await fetch(`/api/admin/articles/${id}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: action }),
      });
      moderatePerf.log({ status: res.status, mode: action });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Не удалось выполнить действие");
        return;
      }
      if (data && typeof data === "object" && "id" in data) {
        applySnapshot(data as ArticleEditorSnapshot);
      }
      toast.success(action === "publish" ? "Публикация одобрена" : "Публикация отклонена");
      router.replace(`/admin/content/publications/new?type=news&id=${encodeURIComponent(id)}`);
    } finally {
      setModerating(false);
      setActionsBusy(false);
    }
  };

  const publicBase = resolveSeoPublicBase();
  const {
    previewSlug,
    onSlugChange,
    isSlugPinned,
    showPublishedSlugWarning,
  } = usePublicationSlugField({
    title,
    slug,
    setSlug,
    persistedSlug: pinnedSlug,
    isPublished: status === "PUBLISHED",
    emptyFallback: "article",
    slugHistorySupported: true,
  });
  // Derive the city slug from the cities list for URL preview.
  const selectedCitySlug = cityId ? (cities.find((c) => c.id === cityId)?.slug ?? null) : null;
  // Guard: when CITY is chosen but no city is selected yet, suppress the URL preview entirely
  // rather than letting buildArticlePublicPath fall back to /blog/{slug} (which would be misleading).
  const previewUrlReady = geoScope !== "CITY" || selectedCitySlug !== null;
  const publicNewsUrl = previewSlug && previewUrlReady
    ? `${publicBase}${buildArticlePublicPath({
        slug: previewSlug,
        geoScope: geoScope ?? undefined,
        citySlug: selectedCitySlug,
      })}`
    : null;
  const previewHref = articleId?.trim() ? `/preview/articles/${articleId.trim()}` : null;
  const publicUrl = status === "PUBLISHED" && previewSlug ? publicNewsUrl : null;

  if (loadState === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Загрузка черновика…
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <p className="text-sm text-destructive">{loadError ?? "Не удалось загрузить черновик"}</p>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {notBreakingWarning ? (
        <p className="text-sm rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-amber-950">
          Эта запись не помечена как Breaking news (ожидался служебный subtitle). Сохранение перезапишет её в
          формате Breaking news.
        </p>
      ) : null}
      <section className="space-y-4">
        <div className="space-y-2">
          <Label>Заголовок</Label>
          <Input
            placeholder="Добавьте заголовок Breaking News"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
          />
        </div>
        <PublicationSlugField
          id="breaking-news-slug"
          slug={slug}
          onSlugChange={onSlugChange}
          previewSlug={previewSlug}
          previewUrl={publicNewsUrl}
          isSlugPinned={isSlugPinned}
          showPublishedSlugWarning={showPublishedSlugWarning}
          slugHistorySupported
        />

        {/* ── География публикации ─────────────────────────────────── */}
        <div className="space-y-3">
          <div>
            <Label>География публикации</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Обязательно перед публикацией. Определяет URL и аудиторию материала.
            </p>
          </div>
          {hydrated ? (
            <RadioGroup
              value={geoScope ?? "__unset__"}
              onValueChange={(v) => {
                if (v === "COUNTRY") {
                  setGeoScope("COUNTRY");
                  setCityId(null);
                } else if (v === "CITY") {
                  setGeoScope("CITY");
                } else {
                  setGeoScope(null);
                  setCityId(null);
                }
                setGeoScopeError(null);
              }}
              className="gap-3"
            >
              <div className="flex items-start gap-2">
                <RadioGroupItem value="COUNTRY" id="bn-geo-country" className="mt-0.5" />
                <Label htmlFor="bn-geo-country" className="cursor-pointer font-normal">
                  <span className="font-medium">Вся Беларусь</span>
                  <span className="block text-xs text-muted-foreground">
                    Материал не привязан к конкретному городу — URL: /blog/&#123;slug&#125;
                  </span>
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="CITY" id="bn-geo-city" className="mt-0.5" />
                <Label htmlFor="bn-geo-city" className="cursor-pointer font-normal">
                  <span className="font-medium">Город</span>
                  <span className="block text-xs text-muted-foreground">
                    Локальный материал — URL: /&#123;город&#125;/blog/&#123;slug&#125;
                  </span>
                </Label>
              </div>
            </RadioGroup>
          ) : (
            <div className="h-16 rounded-md border border-input bg-muted/40 animate-pulse" aria-hidden />
          )}

          {geoScope === "CITY" ? (
            <div className="space-y-1.5 pl-6">
              <Label htmlFor="bn-city-select">Город</Label>
              {hydrated ? (
                <Select
                  value={cityId ?? "__none__"}
                  onValueChange={(v) => {
                    setCityId(v === "__none__" ? null : v);
                    setGeoScopeError(null);
                  }}
                >
                  <SelectTrigger id="bn-city-select" className="w-full max-w-xs">
                    <SelectValue placeholder="Выберите город" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Не выбран</SelectItem>
                    {cities.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-9 max-w-xs rounded-md border border-input bg-muted/40 animate-pulse" aria-hidden />
              )}
            </div>
          ) : null}

          {geoScopeError ? (
            <p className="text-xs text-red-600">{geoScopeError}</p>
          ) : null}
        </div>
        {/* ─────────────────────────────────────────────────────────── */}

        <ArticleEditorCoverField
          value={coverImageId}
          initialPreviewUrl={coverImagePreviewUrl || undefined}
          onChange={(id, previewUrl) => {
            setCoverImageId(id);
            setCoverImagePreviewUrl(previewUrl ?? "");
          }}
        />
        <ArticleEditorGalleryField value={galleryIds} onChange={setGalleryIds} />
        <div className="space-y-2">
          <Label>Текст</Label>
          <ArticleBlockRichEditor
            variant="text"
            value={bodyHtml}
            onChange={setBodyHtml}
            placeholder="Текст абзаца"
            minHeightClass="min-h-[200px]"
          />
        </div>
        <div className="space-y-2">
          <Label>Цены</Label>
          {linkedEntityType === "PLACE" && linkedEntityId.trim() ? (
            <PlaceLinkedPricesEditor placeId={linkedEntityId.trim()} />
          ) : (
            <ArticleBlockRichEditor
              variant="text"
              value={pricingHtml}
              onChange={setPricingHtml}
              placeholder="Цены, скидки, условия…"
              minHeightClass="min-h-[200px]"
            />
          )}
        </div>
        {/* TODO: Add optional Article.relatedPlaceId picker for editorial context (DB field already exists).
              Geography must remain controlled by the geo selector above (geoScope/cityId),
              NOT by the selected place. See Article.relatedPlace in schema.prisma. */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Связанное место / активность</Label>
            <ActivityCardEntityPicker
              entityType={linkedEntityType}
              entityId={linkedEntityId}
              onChangeType={setLinkedEntityType}
              onChangeId={setLinkedEntityId}
            />
          </div>
          {linkedEntityType === "PLACE" && linkedEntityId.trim() ? (
            <PlaceLinkedContactsEditor placeId={linkedEntityId.trim()} />
          ) : linkedEntityType === "PLACE" ? (
            <p className="text-sm text-muted-foreground">
              Выберите место выше — здесь появятся те же поля «Контакты» и «Соцсети», что в мастере места; данные
              сохраняются в карточку места.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Контакты и соцсети ведутся в карточке места. Переключите связь на «Место» и выберите площадку, чтобы
              отредактировать телефон, сайт и Instagram.
            </p>
          )}
        </div>
      </section>

      <SeoPanel
        entityKey={articleId ?? "new-breaking-news"}
        seoTitle={seoTitle}
        seoDescription={seoDescription}
        canonicalUrl={seoCanonicalUrl}
        noindex={noindex}
        coverImageUrl={coverImagePreviewUrl || undefined}
        fallbackTitle={generateBreakingNewsSeoTitle(title)}
        fallbackDescription={generateBreakingNewsSeoDescription(bodyHtml, title)}
        publicUrl={publicNewsUrl || undefined}
        entityType="breaking-news"
        disabled={actionsBusy}
        onSeoTitleChange={setSeoTitle}
        onSeoDescriptionChange={setSeoDescription}
        onCanonicalUrlChange={setSeoCanonicalUrl}
        onNoindexChange={setNoindex}
      />

      {/* Публикация */}
      <PublicationPanel
        views={views}
        status={status}
        onStatusChange={setStatus}
        scheduledAtLocal={scheduledAtLocal}
        publishedAtLocal={publishedAtLocal}
        onScheduledAtChange={setScheduledAtLocal}
        onPublishedAtChange={setPublishedAtLocal}
        authorUserId={authorUserId}
        onAuthorChange={(id) => {
          setAuthorUserId(id);
          if (id) setAuthorError(null);
        }}
        authorError={authorError}
        isAdminEditor={isAdminEditor}
        actionsBusy={actionsBusy}
        submitting={submitting}
        saving={saving}
        moderating={moderating}
        onPublish={() => void submitForModeration()}
        onSaveDraft={() => void saveDraft()}
        onApprove={() => void moderate("publish")}
        onReject={() => void moderate("reject")}
        previewHref={previewHref}
        publicUrl={publicUrl}
      />

      <AlertDialog open={leaveDialogOpen} onOpenChange={onLeaveDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Несохранённые изменения</AlertDialogTitle>
            <AlertDialogDescription>
              Вы изменили Breaking news. Уйти без сохранения? Несохранённые правки будут потеряны.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Остаться</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={confirmLeave}>
              Уйти без сохранения
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function ArticlePublicationEditor() {
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [noindex, setNoindex] = useState(false);

  return (
    <div className="space-y-8 max-w-3xl">
      <section className="space-y-4">
        <div className="space-y-2">
          <Label>Заголовок</Label>
          <Input />
        </div>
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input placeholder="url-slug" className="font-mono text-sm" />
        </div>
        <div className="space-y-2">
          <Label>Автор (отображаемое имя)</Label>
          <Input />
        </div>
        <div className="space-y-2">
          <Label>Анонс</Label>
          <Textarea rows={3} />
        </div>
        <div className="space-y-2">
          <Label>Обложка (media ID)</Label>
          <Input />
        </div>
        <ArticleTocToggle />
      </section>
      <ArticleBlocksEditor />
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Статус</Label>
          <Select defaultValue={PublicationStatus.DRAFT}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(PublicationStatus).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Дата публикации</Label>
          <Input type="datetime-local" />
        </div>
      </section>
      <SeoPanel
        entityKey="article-publication-editor-demo"
        seoTitle={seoTitle}
        seoDescription={seoDescription}
        canonicalUrl={canonicalUrl}
        noindex={noindex}
        fallbackTitle="Заголовок статьи — mamaGo"
        fallbackDescription="Короткий лид статьи появится здесь."
        entityType="article"
        onSeoTitleChange={setSeoTitle}
        onSeoDescriptionChange={setSeoDescription}
        onCanonicalUrlChange={setCanonicalUrl}
        onNoindexChange={setNoindex}
      />
    </div>
  );
}

export function CollectionPublicationEditor() {
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [noindex, setNoindex] = useState(false);

  return (
    <div className="space-y-8 max-w-3xl">
      <section className="space-y-4">
        <div className="space-y-2">
          <Label>Заголовок</Label>
          <Input />
        </div>
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input className="font-mono text-sm" />
        </div>
        <div className="space-y-2">
          <Label>Вводный SEO-текст</Label>
          <Textarea rows={5} />
        </div>
        <div className="space-y-2">
          <Label>Дополнительный текст</Label>
          <Textarea rows={4} placeholder="Опционально" />
        </div>
        <div className="space-y-2 rounded-lg border border-dashed border-gray-200 p-4">
          <Label>Конфиг выдачи (feed)</Label>
          <p className="text-xs text-gray-500 mb-2">
            Пресеты фильтров и источник ленты — подключение к API на следующем этапе.
          </p>
          <Textarea rows={4} className="font-mono text-xs" placeholder="{ }" disabled />
        </div>
        <div className="space-y-2">
          <Label>Сортировка</Label>
          <Select defaultValue="newest">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Сначала новые</SelectItem>
              <SelectItem value="popular">По популярности</SelectItem>
              <SelectItem value="editorial">Редакторский порядок</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Статус</Label>
            <Select defaultValue={PublicationStatus.DRAFT}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(PublicationStatus).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Дата публикации</Label>
            <Input type="datetime-local" />
          </div>
        </div>
      </section>
      <SeoPanel
        entityKey="collection-publication-editor-demo"
        seoTitle={seoTitle}
        seoDescription={seoDescription}
        canonicalUrl={canonicalUrl}
        noindex={noindex}
        fallbackTitle="Подборка mamaGo"
        fallbackDescription="Краткое описание подборки появится здесь."
        entityType="collection"
        onSeoTitleChange={setSeoTitle}
        onSeoDescriptionChange={setSeoDescription}
        onCanonicalUrlChange={setCanonicalUrl}
        onNoindexChange={setNoindex}
      />
    </div>
  );
}
