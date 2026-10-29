"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContentStatus, type ArticlePublicationType, type GeoScope } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardMultiSelect } from "@/components/ui/card-multiselect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ArticleEditorSnapshot, ArticleLinkedItemSnapshot } from "@/lib/article/articleAdminTypes";
import { ArticleLinkedItemsEditor } from "@/components/admin/articles/ArticleLinkedItemsEditor";
import {
  BREAKING_NEWS_DEFAULT_TTL_DAYS,
  COLLECTION_MIN_ITEMS,
  defaultBreakingNewsExpiresAt,
} from "@/lib/journal/publicationType";
import { geographyTargetKey, type ArticleGeographyTargetInput } from "@/lib/article/articleGeographyTargets";
import {
  deriveArticleExcerptFromContent,
  ArticleContentPayloadSchema,
  articleContentValidationMessage,
  prepareArticleContentForSave,
  type ArticleContentPayload,
} from "@/lib/publications/articleMvp";
import { ArticleBlocksMvpEditor } from "@/components/admin/articles/ArticleBlocksMvpEditor";
import { ArticleEditorCoverField } from "@/components/admin/articles/ArticleEditorCoverField";
import { useArticleMediaSource } from "@/components/admin/articles/useArticleMediaSource";
import {
  PublicationPanel,
  STATUS_LABEL,
  statusBadgeClass,
} from "@/components/admin/articles/PublicationPanel";
import { resolveArticlePublicationActionPolicy } from "@/components/admin/articles/articlePublicationActionPolicy";
import { ArticleEditorStickyBar } from "@/components/admin/articles/ArticleEditorStickyBar";
import { SeoPanel } from "@/features/admin/seo/components/SeoPanel";
import { resolveSeoPublicBase } from "@/lib/admin/seo/seoEditorCanonical";
import {
  isPublishLikeStatus,
  validateArticleGeoScope,
} from "@/lib/article/articleGeoScopeValidation";
import { buildArticlePublicPath } from "@/lib/routing/cityPaths";
import { usePublicationSlugField } from "@/hooks/usePublicationSlugField";
import { PublicationSlugField } from "@/components/admin/publications/PublicationSlugField";
import { useHydrated } from "@/hooks/use-hydrated";
import { useUnsavedChangesNavigationGuard } from "@/hooks/use-unsaved-changes-navigation-guard";
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
import { resolveDraftTitle } from "@/lib/content-editor/resolveDraftTitle";
import { ContentSuccessModal } from "@/components/shared/ContentSuccessModal";
import { resolveContentSuccessState } from "@/lib/content-success/resolver";
import type { ContentSuccessPayload, ResolvedContentSuccessState } from "@/lib/content-success/types";
import {
  buildEditorComparable,
  buildSavedComparable,
  fromLocalDatetimeValue,
  toLocalDatetimeValue,
} from "@/lib/article/articleEditorComparable";
import { detachLegacyArticleMainGallery } from "@/lib/article/articleMainGallery";

function applySnapshot(setters: {
  setTitle: (v: string) => void;
  setSlug: (v: string) => void;
  setCoverImageId: (v: string) => void;
  setAuthorUserId: (v: string | null) => void;
  setAuthorLabel: (v: string) => void;
  setCityContext: (v: string) => void;
  setCategoryId: (v: string | null) => void;
  setAdditionalCategoryIds: (v: string[]) => void;
  setAdditionalGeographyTargets: (v: ArticleGeographyTargetInput[]) => void;
  setTagIds: (v: string[]) => void;
  setGeoScope: (v: GeoScope | null) => void;
  setCityId: (v: string | null) => void;
  setRegionId: (v: string | null) => void;
  setContent: (v: ArticleContentPayload) => void;
  setStatus: (v: ContentStatus) => void;
  setPublishedAtLocal: (v: string) => void;
  setScheduledAtLocal: (v: string) => void;
  setSeoTitle: (v: string) => void;
  setSeoDescription: (v: string) => void;
  setSeoCanonicalUrl: (v: string) => void;
  setNoindex: (v: boolean) => void;
  setViews: (v: number) => void;
  setPublicationType: (v: ArticlePublicationType) => void;
  setFeatured: (v: boolean) => void;
  setPinned: (v: boolean) => void;
  setExpiresAtLocal: (v: string) => void;
  setLinkedItems: (v: ArticleLinkedItemSnapshot[]) => void;
}, snap: ArticleEditorSnapshot) {
  setters.setTitle(snap.title);
  setters.setSlug(snap.slug ?? "");
  setters.setCoverImageId(snap.coverImageId ?? "");
  setters.setAuthorUserId(snap.authorUserId ?? null);
  setters.setAuthorLabel(snap.authorLabel ?? "");
  setters.setCityContext(snap.cityContext ?? "");
  setters.setCategoryId(snap.categoryId ?? null);
  setters.setAdditionalCategoryIds(snap.additionalCategoryIds ?? []);
  setters.setAdditionalGeographyTargets(snap.additionalGeographyTargets ?? []);
  setters.setTagIds(snap.tagIds);
  setters.setGeoScope(snap.geoScope ?? null);
  setters.setCityId(snap.cityId ?? null);
  setters.setRegionId(snap.regionId ?? null);
  setters.setContent(snap.content);
  setters.setStatus(snap.status);
  setters.setPublishedAtLocal(toLocalDatetimeValue(snap.publishedAt));
  setters.setScheduledAtLocal(toLocalDatetimeValue(snap.scheduledAt));
  setters.setSeoTitle(snap.seoTitle ?? "");
  setters.setSeoDescription(snap.seoDescription ?? "");
  setters.setSeoCanonicalUrl(snap.seoCanonicalUrl ?? "");
  setters.setNoindex(snap.noindex);
  setters.setViews(snap.views);
  setters.setPublicationType(snap.publicationType);
  setters.setFeatured(snap.featured);
  setters.setPinned(snap.pinned);
  setters.setExpiresAtLocal(toLocalDatetimeValue(snap.expiresAt));
  setters.setLinkedItems(snap.linkedItems);
}

const PUBLICATION_TYPE_OPTIONS: Array<{ value: ArticlePublicationType; label: string; hint: string }> = [
  { value: "ARTICLE", label: "Статья", hint: "Обычный материал журнала, без бейджа." },
  { value: "COLLECTION", label: "Подборка", hint: `Бейдж «Подборка», блок «Подборки mamaGo». Минимум ${COLLECTION_MIN_ITEMS} элемента.` },
  { value: "BREAKING_NEWS", label: "Новость", hint: `Бейдж «Новость», блок «Новости» до даты «Актуально до» (по умолчанию +${BREAKING_NEWS_DEFAULT_TTL_DAYS} дней).` },
];

export function ArticleEditorClient({
  initial,
  canModerate = false,
}: {
  initial: ArticleEditorSnapshot;
  /** Только ADMIN/MODERATOR видят решения по статье в статусе PENDING. */
  canModerate?: boolean;
}) {
  const initialArticleMedia = useMemo(
    () => detachLegacyArticleMainGallery({ coverImageId: initial.coverImageId, content: initial.content }),
    [initial.coverImageId, initial.content],
  );
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [moderating, setModerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasContentValidationError, setHasContentValidationError] = useState(false);
  const [views, setViews] = useState(initial.views);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(() => {
    const t = Date.parse(initial.updatedAt);
    return Number.isNaN(t) ? null : t;
  });
  const [, setSaveHintTick] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successState, setSuccessState] = useState<ResolvedContentSuccessState | null>(null);

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug ?? "");
  const [pinnedSlug, setPinnedSlug] = useState<string | null>(initial.slug?.trim() || null);
  const [coverImageId, setCoverImageId] = useState(initialArticleMedia.coverImageId ?? "");
  const [coverImagePreviewUrl, setCoverImagePreviewUrl] = useState(initial.coverImageUrl ?? "");
  const [coverCaption, setCoverCaption] = useState(initial.content.coverCaption ?? "");
  const [authorUserId, setAuthorUserId] = useState<string | null>(initial.authorUserId ?? null);
  const [authorLabel, setAuthorLabel] = useState(initial.authorLabel ?? "");
  const [cityContext, setCityContext] = useState(initial.cityContext ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(initial.categoryId ?? null);
  const [additionalCategoryIds, setAdditionalCategoryIds] = useState<string[]>(initial.additionalCategoryIds ?? []);
  const [additionalGeographyTargets, setAdditionalGeographyTargets] = useState<ArticleGeographyTargetInput[]>(initial.additionalGeographyTargets ?? []);
  const [tagIds, setTagIds] = useState<string[]>(initial.tagIds);
  const [geoScope, setGeoScope] = useState<GeoScope | null>(initial.geoScope ?? null);
  const [cityId, setCityId] = useState<string | null>(initial.cityId ?? null);
  const [regionId, setRegionId] = useState<string | null>(initial.regionId ?? null);
  const [cities, setCities] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [regions, setRegions] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; label: string; slug: string }[]>([]);
  const [discoveryTags, setDiscoveryTags] = useState<
    { id: string; title: string; description: string | null; isActive: boolean }[]
  >([]);
  const [geoScopeError, setGeoScopeError] = useState<string | null>(null);
  const [content, setContent] = useState<ArticleContentPayload>(initialArticleMedia.content);
  const [status, setStatus] = useState<ContentStatus>(initial.status);
  const [publishedAtLocal, setPublishedAtLocal] = useState(toLocalDatetimeValue(initial.publishedAt));
  const [scheduledAtLocal, setScheduledAtLocal] = useState(toLocalDatetimeValue(initial.scheduledAt));
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription ?? "");
  const [seoCanonicalUrl, setSeoCanonicalUrl] = useState(initial.seoCanonicalUrl ?? "");
  const [noindex, setNoindex] = useState(initial.noindex);
  const [publicationType, setPublicationType] = useState<ArticlePublicationType>(initial.publicationType);
  const [featured, setFeatured] = useState(initial.featured);
  const [pinned, setPinned] = useState(initial.pinned);
  const [expiresAtLocal, setExpiresAtLocal] = useState(toLocalDatetimeValue(initial.expiresAt));
  const [linkedItems, setLinkedItems] = useState<ArticleLinkedItemSnapshot[]>(initial.linkedItems);

  const hydrated = useHydrated();

  /** Запись в БД ещё не создана — только после первого «Сохранить» / «Опубликовать». */
  const hasPersistedId = Boolean(initial.id?.trim());

  /**
   * «Фото этой статьи» — общий источник для всех image/gallery picker'ов на
   * странице (обложка + каждый блок). Persisted-статья читает сервер
   * (/api/admin/articles/[id]/media, актуальный сохранённый contentJson);
   * ещё не сохранённая — тот же extractArticleMediaUsage прямо по текущему
   * editor state, без временной записи в БД ради picker'а.
   */
  const articleMediaSource = useArticleMediaSource({
    articleId: hasPersistedId ? initial.id : null,
    coverImageId,
    blocks: content.blocks,
  });

  const savedComparableRef = useRef(buildSavedComparable({
    ...initial,
    coverImageId: initialArticleMedia.coverImageId,
    content: initialArticleMedia.content,
  }));

  const currentComparable = useMemo(
    () =>
      buildEditorComparable({
        title,
        slug,
        coverImageId,
        authorUserId,
        authorLabel,
        cityContext,
        categoryId,
        additionalCategoryIds,
        additionalGeographyTargets,
        tagIds,
        geoScope,
        cityId,
        regionId,
        content,
        status,
        publishedAtLocal,
        scheduledAtLocal,
        seoTitle,
        seoDescription,
        seoCanonicalUrl,
        noindex,
        publicationType,
        featured,
        pinned,
        expiresAtLocal,
        linkedItems,
      }),
    [
      title,
      slug,
      coverImageId,
      authorUserId,
      authorLabel,
      cityContext,
      categoryId,
      additionalCategoryIds,
      additionalGeographyTargets,
      tagIds,
      geoScope,
      cityId,
      regionId,
      content,
      status,
      publishedAtLocal,
      scheduledAtLocal,
      seoTitle,
      seoDescription,
      seoCanonicalUrl,
      noindex,
      publicationType,
      featured,
      pinned,
      expiresAtLocal,
      linkedItems,
    ],
  );

  const dirty = currentComparable !== savedComparableRef.current;
  const displayTitle = resolveDraftTitle(title, "Новая статья");

  /**
   * Sticky bottom bar показывается только после первого реального
   * пользовательского изменения в этой сессии редактирования — не при
   * первичной гидратации/normalization. После появления остаётся видимой
   * даже когда `dirty` снова становится false (после успешного сохранения).
   */
  const [everDirty, setEverDirty] = useState(false);
  useEffect(() => {
    if (dirty) setEverDirty(true);
  }, [dirty]);

  const { leaveDialogOpen, confirmLeave, onLeaveDialogOpenChange } = useUnsavedChangesNavigationGuard(dirty);

  useEffect(() => {
    const id = window.setInterval(() => setSaveHintTick((n) => n + 1), 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const selectedCategoryIds = [initial.categoryId, ...(initial.additionalCategoryIds ?? [])].filter(Boolean).join(",");
      const selectedCityIds = [initial.cityId, ...(initial.additionalGeographyTargets ?? []).filter((target) => target.type === "CITY").map((target) => target.cityId)].filter(Boolean).join(",");
      const selectedRegionIds = (initial.additionalGeographyTargets ?? []).filter((target) => target.type === "REGION").map((target) => target.regionId).join(",");
      const res = await fetch(`/api/admin/articles/editor-options?selectedCategoryIds=${encodeURIComponent(selectedCategoryIds)}&selectedCityIds=${encodeURIComponent(selectedCityIds)}&selectedRegionIds=${encodeURIComponent(selectedRegionIds)}`);
      if (!res.ok || cancelled) return;
      const data = (await res.json().catch(() => null)) as {
        cities?: { id: string; name: string; slug: string }[];
        regions?: { id: string; name: string; slug: string }[];
        authors?: { id: string; label: string; email: string }[];
        categories?: { id: string; label: string; slug: string }[];
      } | null;
      if (!data || cancelled) return;
      setCities(data.cities ?? []);
      setRegions(data.regions ?? []);
      setCategories(data.categories ?? []);

      const selectedIds = initial.tagIds.join(",");
      const tagsUrl = selectedIds
        ? `/api/admin/discovery-tags?selectedIds=${encodeURIComponent(selectedIds)}`
        : "/api/admin/discovery-tags";
      const tagsRes = await fetch(tagsUrl);
      if (!tagsRes.ok || cancelled) return;
      const tagsData = (await tagsRes.json().catch(() => null)) as
        | { id: string; title: string; description: string | null; isActive: boolean }[]
        | null;
      if (!tagsData || cancelled) return;
      setDiscoveryTags(tagsData);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initial.categoryId, initial.additionalCategoryIds, initial.additionalGeographyTargets, initial.cityId, initial.tagIds]);

  const {
    previewSlug,
    onSlugChange,
    hydrateSlug,
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

  const selectedCity = cities.find((c) => c.id === cityId) ?? null;
  const previewSeg = previewSlug;
  const publicArticlePath = previewSeg
    ? buildArticlePublicPath({
        slug: previewSeg,
        geoScope,
        citySlug: selectedCity?.slug,
      })
    : null;
  const publicArticleUrl = publicArticlePath
    ? `${resolveSeoPublicBase()}${publicArticlePath}`
    : undefined;
  const publicUrl = status === "PUBLISHED" && publicArticlePath
    ? `${resolveSeoPublicBase()}${publicArticlePath}`
    : null;

  const derivedExcerpt = useMemo(
    () => deriveArticleExcerptFromContent(content) ?? "",
    [content],
  );

  const editorSetters = useMemo(
    () => ({
      setTitle,
      setSlug,
      setCoverImageId,
      setAuthorUserId,
      setAuthorLabel,
      setCityContext,
      setCategoryId,
      setAdditionalCategoryIds,
      setAdditionalGeographyTargets,
      setTagIds,
      setGeoScope,
      setCityId,
      setRegionId,
      setContent,
      setStatus,
      setPublishedAtLocal,
      setScheduledAtLocal,
      setSeoTitle,
      setSeoDescription,
      setSeoCanonicalUrl,
      setNoindex,
      setViews,
      setPublicationType,
      setFeatured,
      setPinned,
      setExpiresAtLocal,
      setLinkedItems,
    }),
    [],
  );

  const applyEditorSnapshot = useCallback(
    (snap: ArticleEditorSnapshot) => {
      applySnapshot(editorSetters, snap);
      const articleMedia = detachLegacyArticleMainGallery({ coverImageId: snap.coverImageId, content: snap.content });
      setCoverImageId(articleMedia.coverImageId ?? "");
      setContent(articleMedia.content);
      setPinnedSlug(snap.slug?.trim() || null);
      hydrateSlug(snap.slug);
    },
    [editorSetters, hydrateSlug],
  );

  useEffect(() => {
    if (!coverImageId) {
      setCoverImagePreviewUrl("");
      return;
    }
    let cancelled = false;
    void fetch(`/api/admin/articles/media-preview?id=${encodeURIComponent(coverImageId)}`, { credentials: "include" })
      .then((response) => response.ok ? response.json() as Promise<{ publicUrl: string | null }> : null)
      .then((data) => {
        if (!cancelled) setCoverImagePreviewUrl(data?.publicUrl ?? "");
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [coverImageId]);

  const showSuccessModal = useCallback(
    (payload: Omit<ContentSuccessPayload, "surface" | "returnTo">) => {
      const next = resolveContentSuccessState({
        ...payload,
        surface: "admin",
      });
      if (!next) return;
      setSuccessState(next);
      setSuccessModalOpen(true);
    },
    [],
  );

  const validateGeoScopeForWrite = useCallback((strict: boolean): boolean => {
    const result = validateArticleGeoScope({ geoScope, cityId, regionId, strict });
    if (!result.ok) {
      setGeoScopeError(result.message);
      setError(result.message);
      toast.error(result.message);
      return false;
    }
    setGeoScopeError(null);
    return true;
  }, [geoScope, cityId, regionId]);

  const payload = useMemo(
    () => ({
      title,
      slug: slug.trim() || null,
      subtitle: null as string | null,
      excerpt: deriveArticleExcerptFromContent(content),
      content: { ...prepareArticleContentForSave(content), coverCaption: coverCaption.trim() || undefined },
      coverImageId: coverImageId.trim() || null,
      authorLabel: authorLabel.trim() || null,
      authorUserId: authorUserId || null,
      cityContext: cityContext.trim() || null,
      categoryId,
      additionalCategoryIds,
      additionalGeographyTargets,
      tagIds,
      geoScope,
      cityId,
      regionId,
      status,
      publishedAt: fromLocalDatetimeValue(publishedAtLocal),
      scheduledAt: fromLocalDatetimeValue(scheduledAtLocal),
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      seoCanonicalUrl: seoCanonicalUrl.trim() || null,
      seoOgTitle: null as string | null,
      seoOgDescription: null as string | null,
      seoRobots: null as string | null,
      noindex,
      publicationType,
      featured,
      pinned,
      expiresAt: publicationType === "BREAKING_NEWS" ? fromLocalDatetimeValue(expiresAtLocal) : null,
      linkedItems: linkedItems.map(({ kind, id }) => ({ kind, id })),
    }),
    [
      title,
      slug,
      content,
      coverImageId,
      coverCaption,
      authorLabel,
      authorUserId,
      cityContext,
      categoryId,
      additionalCategoryIds,
      additionalGeographyTargets,
      tagIds,
      geoScope,
      cityId,
      regionId,
      status,
      publishedAtLocal,
      scheduledAtLocal,
      seoTitle,
      seoDescription,
      seoCanonicalUrl,
      noindex,
      publicationType,
      featured,
      pinned,
      expiresAtLocal,
      linkedItems,
    ],
  );

  useEffect(() => {
    if (!geoScopeError) return;
    const result = validateArticleGeoScope({ geoScope, cityId, regionId, strict: true });
    if (result.ok) setGeoScopeError(null);
  }, [geoScope, cityId, regionId, geoScopeError]);

  const persistComparableFromSnapshot = useCallback((snap: ArticleEditorSnapshot) => {
    savedComparableRef.current = buildSavedComparable(snap);
  }, []);

  const showArticleSuccess = useCallback(
    (
      outcome: ContentSuccessPayload["outcome"],
      articleId: string,
      snap?: ArticleEditorSnapshot | null,
      isEdit = true,
    ) => {
      const source = snap ?? {
        slug,
        geoScope,
        cityId,
      };
      const modalCitySlug =
        source.cityId != null
          ? (cities.find((city) => city.id === source.cityId)?.slug ?? null)
          : null;
      showSuccessModal({
        kind: "article",
        outcome,
        id: articleId,
        isEdit,
        slug: source.slug ?? null,
        geoScope: source.geoScope ?? null,
        citySlug: modalCitySlug,
      });
    },
    [cities, cityId, geoScope, showSuccessModal, slug],
  );

  const save = useCallback(
    async (opts?: { silent?: boolean; skipLoading?: boolean }): Promise<boolean> => {
      if (!validateGeoScopeForWrite(isPublishLikeStatus(status))) return false;
      const contentResult = ArticleContentPayloadSchema.safeParse(payload.content);
      if (!contentResult.success) {
        const msg = articleContentValidationMessage(contentResult.error.issues);
        setHasContentValidationError(true);
        setError(msg);
        toast.error(msg);
        return false;
      }
      setHasContentValidationError(false);
      const journalError = publicationType === "COLLECTION" && linkedItems.length < COLLECTION_MIN_ITEMS
        ? `В подборке должно быть минимум ${COLLECTION_MIN_ITEMS} элемента`
        : publicationType === "BREAKING_NEWS" && !expiresAtLocal.trim()
          ? "Для новости укажите «Актуально до»"
          : null;
      if (journalError) {
        setError(journalError);
        toast.error(journalError);
        return false;
      }
      const requestPayload = { ...payload, content: contentResult.data };
      if (!opts?.skipLoading) setSaving(true);
      setError(null);
      try {
        if (!hasPersistedId) {
          const res = await fetch("/api/admin/articles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestPayload),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            const msg =
              typeof data.error === "string"
                ? data.error
                : data.error?.message || data.message || "Не удалось сохранить черновик";
            setError(msg);
            toast.error(msg);
            return false;
          }
          const next = data as ArticleEditorSnapshot;
          applyEditorSnapshot(next);
          persistComparableFromSnapshot(next);
          const updated = Date.parse(next.updatedAt);
          if (!Number.isNaN(updated)) setLastSavedAt(updated);
          else setLastSavedAt(Date.now());
          if (!opts?.silent) {
            showArticleSuccess("draft_saved", next.id, next, false);
          }
          router.replace(`/admin/content/articles/${next.id}/edit`);
          router.refresh();
          return true;
        }

        const res = await fetch(`/api/admin/articles/${initial.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : data.error?.message || data.message || "Не удалось сохранить черновик";
          setError(msg);
          toast.error(msg);
          return false;
        }
        const next = data as ArticleEditorSnapshot;
        applyEditorSnapshot(next);
        persistComparableFromSnapshot(next);
        const updated = Date.parse(next.updatedAt);
        if (!Number.isNaN(updated)) setLastSavedAt(updated);
        else setLastSavedAt(Date.now());
        if (!opts?.silent) {
          showArticleSuccess(
            next.status === "PUBLISHED" ? "changes_published" : "draft_saved",
            next.id,
            next,
            true,
          );
        }
        router.refresh();
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Ошибка сохранения";
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        if (!opts?.skipLoading) setSaving(false);
      }
    },
    [
      applyEditorSnapshot,
      expiresAtLocal,
      hasPersistedId,
      initial.id,
      linkedItems.length,
      payload,
      persistComparableFromSnapshot,
      publicationType,
      router,
      showArticleSuccess,
      status,
      validateGeoScopeForWrite,
    ],
  );

  const fetchSnapshot = useCallback(
    async (articleId?: string): Promise<ArticleEditorSnapshot | null> => {
      const id = articleId ?? initial.id;
      if (!id.trim()) return null;
      const res = await fetch(`/api/admin/articles/${id}`);
      if (!res.ok) return null;
      return (await res.json()) as ArticleEditorSnapshot;
    },
    [initial.id],
  );

  const submitForModeration = useCallback(async () => {
    if (!validateGeoScopeForWrite(true)) return;
    setSubmitting(true);
    try {
      let articleId = initial.id.trim();

      if (!articleId) {
        setError(null);
        const contentResult = ArticleContentPayloadSchema.safeParse(payload.content);
        if (!contentResult.success) {
          const msg = articleContentValidationMessage(contentResult.error.issues);
          setHasContentValidationError(true);
          setError(msg);
          toast.error(msg);
          return;
        }
        setHasContentValidationError(false);
        const res = await fetch("/api/admin/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, content: contentResult.data }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : data.error?.message || data.message || "Не удалось создать статью";
          setError(msg);
          toast.error(msg);
          return;
        }
        const created = data as ArticleEditorSnapshot;
        articleId = created.id;
        applyEditorSnapshot(created);
        persistComparableFromSnapshot(created);
      } else {
        const ok = await save({ silent: true, skipLoading: true });
        if (!ok) return;
      }

      const res = await fetch(`/api/admin/articles/${articleId}/submit`, { method: "POST" });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Не удалось отправить на модерацию";
        setError(msg);
        toast.error(msg);
        return;
      }
      const next = await fetchSnapshot(articleId);
      if (next) {
        applyEditorSnapshot(next);
        persistComparableFromSnapshot(next);
        const updated = Date.parse(next.updatedAt);
        if (!Number.isNaN(updated)) setLastSavedAt(updated);
      }
      showArticleSuccess("submitted", articleId, next, Boolean(initial.id.trim()));
      router.replace(`/admin/content/articles/${articleId}/edit`);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    save,
    initial.id,
    payload,
    fetchSnapshot,
    persistComparableFromSnapshot,
    router,
    validateGeoScopeForWrite,
    applyEditorSnapshot,
    showArticleSuccess,
  ]);

  const moderate = useCallback(
    async (decision: "publish" | "reject") => {
      if (decision === "publish" && !validateGeoScopeForWrite(true)) return;
      setError(null);
      setModerating(true);
      try {
        if (decision === "publish") {
          const saved = await save({ silent: true, skipLoading: true });
          if (!saved) return;
        }
        const res = await fetch(`/api/admin/articles/${initial.id}/moderate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof data.error === "string" ? data.error : "Действие модерации не выполнено";
          setError(msg);
          toast.error(msg);
          return;
        }
        const next = await fetchSnapshot(initial.id);
        if (next) {
          applyEditorSnapshot(next);
          persistComparableFromSnapshot(next);
          const updated = Date.parse(next.updatedAt);
          if (!Number.isNaN(updated)) setLastSavedAt(updated);
        }
        if (decision === "publish") {
          showArticleSuccess("published", initial.id, next, true);
        } else {
          toast.success("Статья отклонена");
        }
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Ошибка модерации";
        toast.error(msg);
      } finally {
        setModerating(false);
      }
    },
    [
      initial.id,
      fetchSnapshot,
      persistComparableFromSnapshot,
      router,
      validateGeoScopeForWrite,
      applyEditorSnapshot,
      showArticleSuccess,
      save,
    ],
  );

  const confirmDeleteArticle = useCallback(async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/articles/${initial.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof (data as { message?: string }).message === "string"
            ? (data as { message: string }).message
            : typeof (data as { error?: string }).error === "string"
              ? (data as { error: string }).error
              : typeof (data as { code?: string }).code === "string"
                ? (data as { code: string }).code
              : "Не удалось удалить статью";
        setError(msg);
        toast.error(msg);
        return;
      }
      setDeleteDialogOpen(false);
      toast.success("Статья удалена");
      router.push("/admin/content/publications");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка удаления";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }, [initial.id, router]);

  const actionsBusy = saving || submitting || moderating || deleting;

  const saveStatusLabel = (() => {
    if (dirty) {
      return "Изменения не сохранены";
    }
    if (lastSavedAt != null) {
      return `Сохранено ${formatDistanceToNow(lastSavedAt, { addSuffix: true, locale: ru })}`;
    }
    return null;
  })();

  /** Статус для sticky bottom bar — те же state-переменные, что и выше, без отдельной autosave-логики. */
  const stickyStatus: "dirty" | "saving" | "saved" | "error" = error
    ? "error"
    : saving
      ? "saving"
      : dirty
        ? "dirty"
        : "saved";
  const stickyStatusLabel = error
    ? hasContentValidationError ? "Проверьте поля в статье" : "Не удалось сохранить"
    : saving
      ? "Сохранение…"
      : dirty
        ? "Изменения не сохранены"
        : lastSavedAt != null
          ? `Сохранено ${formatDistanceToNow(lastSavedAt, { addSuffix: true, locale: ru })}`
          : "Изменения сохранены";

  /**
   * Единственный источник условий видимости/disabled для «Одобрить» — та же
   * чистая функция, что использует верхний PublicationPanel. Sticky-панель
   * не переизобретает permissions/status-условия, только читает их отсюда.
   */
  const publicationActionPolicy = resolveArticlePublicationActionPolicy({
    status,
    canModerate,
    hasUnsavedChanges: dirty,
    hasPublicUrl: publicUrl != null,
  });

  const stickyApproveAction =
    publicationActionPolicy.primary?.kind === "approve"
      ? {
          label: moderating ? "Одобрение…" : publicationActionPolicy.primary.label,
          disabled: actionsBusy || publicationActionPolicy.primary.disabled,
          disabledReason: publicationActionPolicy.primary.disabled
            ? publicationActionPolicy.primary.disabledReason
            : null,
          loading: moderating,
          onClick: () => void moderate("publish"),
        }
      : null;

  return (
    <>
    <div className={cn("w-full max-w-4xl space-y-6 px-4 py-4 sm:space-y-8 sm:px-6 sm:py-6", everDirty && "pb-[calc(8rem+env(safe-area-inset-bottom))] md:pb-24")}>
      <div className="flex flex-wrap items-start justify-between gap-3 gap-y-2">
        <div className="min-w-0 flex-1 pr-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            {PUBLICATION_TYPE_OPTIONS.find((option) => option.value === publicationType)?.label ?? "Статья"}
          </p>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900 line-clamp-3 break-words">
            {displayTitle}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0 text-right ml-auto">
          <Badge
            variant="outline"
            className={cn("text-xs font-semibold border", statusBadgeClass(status))}
          >
            {STATUS_LABEL[status] ?? status}
          </Badge>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      ) : null}

      {/* Основная информация */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg">Основная информация</CardTitle>
          <CardDescription>
            Заголовок, категория, адрес страницы, обложка, автор и городской контекст
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-4 sm:px-6">
          <div className="space-y-2">
            <Label>Заголовок</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="article-category">Основная категория</Label>
            <p className="text-xs text-muted-foreground">
              Категории журнала настраиваются в разделе{" "}
              <Link href="/admin/taxonomy/categories?type=ARTICLE" className="underline underline-offset-2">
                Таксономия → Категории
              </Link>
              .
            </p>
            {hydrated ? (
              <Select
                value={categoryId ?? "__none__"}
                onValueChange={(v) => {
                  const next = v === "__none__" ? null : v;
                  setCategoryId(next);
                  if (next) setAdditionalCategoryIds((ids) => ids.filter((id) => id !== next));
                }}
              >
                <SelectTrigger id="article-category" className="w-full">
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Не выбрано</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div
                id="article-category"
                className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground animate-pulse"
                aria-hidden
              >
                …
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="article-additional-categories">Дополнительные категории</Label>
            <p className="text-xs text-muted-foreground">
              Дополнительная классификация статьи по рубрикам.
            </p>
            <div id="article-additional-categories">
              <CardMultiSelect
                placeholder="Выберите дополнительные категории"
                values={additionalCategoryIds}
                onChange={(ids) => setAdditionalCategoryIds(ids.filter((id) => id !== categoryId))}
                options={categories
                  .filter((category) => category.id !== categoryId)
                  .map((category) => ({ value: category.id, label: category.label }))}
                allowClear
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="article-discovery-tags">Теги</Label>
            <p className="text-xs text-muted-foreground">
              Теги управляют подборками и SEO-страницами, но не зависят от города публикации.
            </p>
            <div id="article-discovery-tags">
              <CardMultiSelect
                placeholder="Выберите теги"
                values={tagIds}
                onChange={setTagIds}
                options={discoveryTags.map((tag) => ({
                  value: tag.id,
                  label: tag.isActive ? tag.title : `${tag.title} (выключен)`,
                }))}
                allowClear
              />
            </div>
          </div>
          <PublicationSlugField
            id="article-slug"
            slug={slug}
            onSlugChange={onSlugChange}
            previewSlug={previewSlug}
            previewUrl={publicArticleUrl ?? null}
            isSlugPinned={isSlugPinned}
            showPublishedSlugWarning={showPublishedSlugWarning}
            slugHistorySupported
          />
          <ArticleEditorCoverField
            value={coverImageId}
            initialPreviewUrl={initial.coverImageUrl}
            label="Обложка статьи"
            description="Показывается в карточках журнала и после заголовка статьи."
            authorUserId={authorUserId}
            articleId={hasPersistedId ? initial.id : null}
            onChange={(id, previewUrl) => {
              setCoverImageId(id);
              setCoverImagePreviewUrl(previewUrl ?? "");
            }}
            articleMediaSource={articleMediaSource}
          />

          <div className="space-y-2">
            <Label htmlFor="article-cover-caption">Подпись к обложке</Label>
            <Input id="article-cover-caption" value={coverCaption} maxLength={500} onChange={(event) => setCoverCaption(event.target.value)} placeholder="Например: Фото: автор, источник" />
            <p className="text-xs text-muted-foreground">Необязательно. Отображается под обложкой на странице статьи.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="article-geo-scope">Охват статьи</Label>
              <p className="text-xs text-muted-foreground">
                Обязательно перед публикацией. Городская статья — в разделе города; региональная и
                национальная — на /blog/&#123;slug&#125;.
              </p>
              {hydrated ? (
                <Select
                  value={geoScope ?? "__unset__"}
                  onValueChange={(v) => {
                    if (v === "__unset__") {
                      setGeoScope(null);
                      setCityId(null);
                      setRegionId(null);
                      setCityContext("");
                      return;
                    }
                    const scope = v as GeoScope;
                    setGeoScope(scope);
                    if (scope === "CITY") {
                      setRegionId(null);
                    } else if (scope === "REGION") {
                      setCityId(null);
                      setCityContext("");
                    } else {
                      setCityId(null);
                      setRegionId(null);
                      setCityContext("");
                    }
                  }}
                >
                  <SelectTrigger id="article-geo-scope" className="w-full">
                    <SelectValue placeholder="Выберите охват" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unset__">Не выбрано</SelectItem>
                    <SelectItem value="CITY">Городская (CITY)</SelectItem>
                    <SelectItem value="REGION">Региональная (REGION)</SelectItem>
                    <SelectItem value="COUNTRY">Национальная (COUNTRY)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div
                  id="article-geo-scope"
                  className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground animate-pulse"
                  aria-hidden
                >
                  …
                </div>
              )}
            </div>
            {geoScope === "CITY" ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="article-city">Город</Label>
                {hydrated ? (
                  <Select
                    value={cityId ?? "__none__"}
                    onValueChange={(v) => {
                      if (v === "__none__") {
                        setCityId(null);
                        setCityContext("");
                        return;
                      }
                      const city = cities.find((c) => c.id === v);
                      setCityId(v);
                      setCityContext(city?.slug ?? "");
                    }}
                  >
                    <SelectTrigger id="article-city" className="w-full">
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
                  <div
                    id="article-city"
                    className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground animate-pulse"
                    aria-hidden
                  >
                    …
                  </div>
                )}
              </div>
            ) : null}
            {geoScope === "REGION" ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="article-region">Область</Label>
                {hydrated ? (
                  <Select
                    value={regionId ?? "__none__"}
                    onValueChange={(v) => {
                      setRegionId(v === "__none__" ? null : v);
                    }}
                  >
                    <SelectTrigger id="article-region" className="w-full">
                      <SelectValue placeholder="Выберите область" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Не выбрана</SelectItem>
                      {regions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div
                    id="article-region"
                    className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground animate-pulse"
                    aria-hidden
                  >
                    …
                  </div>
                )}
              </div>
            ) : null}
            {geoScopeError ? (
              <p className="text-xs text-red-600 sm:col-span-2">{geoScopeError}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="article-additional-geography">Дополнительные города и регионы</Label>
            <p className="text-xs text-muted-foreground">
              Дополнительные города и регионы, где статья также релевантна.
            </p>
            <div id="article-additional-geography">
              <CardMultiSelect
                placeholder="Выберите города и регионы"
                values={additionalGeographyTargets.map(geographyTargetKey)}
                onChange={(values) => setAdditionalGeographyTargets(values.map((value) => {
                  const [type, id] = value.split(":", 2);
                  return type === "CITY"
                    ? { type: "CITY" as const, cityId: id }
                    : { type: "REGION" as const, regionId: id };
                }))}
                options={[
                  ...cities.filter((city) => !(geoScope === "CITY" && city.id === cityId)).map((city) => ({ value: `CITY:${city.id}`, label: `${city.name} — город` })),
                  ...regions.filter((region) => !(geoScope === "REGION" && region.id === regionId)).map((region) => ({ value: `REGION:${region.id}`, label: `${region.name} — регион` })),
                ]}
                allowClear
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Тип публикации журнала */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg">Тип публикации</CardTitle>
          <CardDescription>
            Формат материала в журнале. Не зависит от рубрики (раздела) и не меняет адрес страницы.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-4 sm:px-6">
          <div
            role="radiogroup"
            aria-label="Тип публикации"
            className="grid gap-2 sm:grid-cols-3"
          >
            {PUBLICATION_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={publicationType === option.value}
                onClick={() => {
                  setPublicationType(option.value);
                  if (option.value === "BREAKING_NEWS" && !expiresAtLocal) {
                    const base = fromLocalDatetimeValue(publishedAtLocal);
                    setExpiresAtLocal(toLocalDatetimeValue(
                      defaultBreakingNewsExpiresAt(base ? new Date(base) : new Date()).toISOString(),
                    ));
                  }
                }}
                className={cn(
                  "min-h-11 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  publicationType === option.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-gray-200 bg-white hover:border-gray-300",
                )}
              >
                <span className="block text-sm font-semibold text-gray-900">{option.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
              </button>
            ))}
          </div>

          {publicationType === "BREAKING_NEWS" ? (
            <div className="space-y-2">
              <Label htmlFor="article-expires-at">Актуально до</Label>
              <Input
                id="article-expires-at"
                type="datetime-local"
                required
                value={expiresAtLocal}
                onChange={(e) => setExpiresAtLocal(e.target.value)}
                className="sm:max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                Обязательно. После этой даты новость исчезает из блоков и ленты журнала (страница остаётся по прежнему адресу).
              </p>
            </div>
          ) : null}

          {publicationType === "COLLECTION" || linkedItems.length > 0 ? (
            <ArticleLinkedItemsEditor
              items={linkedItems}
              onChange={setLinkedItems}
              articleId={hasPersistedId ? initial.id : null}
              required={publicationType === "COLLECTION"}
            />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex min-h-11 items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
              <Switch checked={featured} onCheckedChange={setFeatured} aria-label="Главное" className="mt-0.5" />
              <span>
                <span className="block text-sm font-semibold text-gray-900">Главное</span>
                <span className="block text-xs text-muted-foreground">Кандидат в большую карточку «★ Главное» — показывается самый свежий.</span>
              </span>
            </label>
            <label className="flex min-h-11 items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
              <Switch checked={pinned} onCheckedChange={setPinned} aria-label="Закрепить" className="mt-0.5" />
              <span>
                <span className="block text-sm font-semibold text-gray-900">Закрепить</span>
                <span className="block text-xs text-muted-foreground">В начале ленты «Свежие материалы».</span>
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Контент */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg">Контент статьи</CardTitle>
          <CardDescription>Блоки в фиксированном порядке</CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <ArticleBlocksMvpEditor
            blocks={content.blocks}
            onChange={(blocks) => setContent((prev) => ({ ...prev, blocks }))}
            authorUserId={authorUserId}
            articleId={hasPersistedId ? initial.id : null}
            articleMediaSource={articleMediaSource}
          />
        </CardContent>
      </Card>

      <SeoPanel
        entityKey={initial.id}
        seoTitle={seoTitle}
        seoDescription={seoDescription}
        canonicalUrl={seoCanonicalUrl}
        noindex={noindex}
        coverImageUrl={coverImagePreviewUrl || initial.coverImageUrl}
        fallbackTitle={title.trim() ? `${title.trim()} — mamaGo` : ""}
        fallbackDescription={derivedExcerpt}
        publicUrl={publicArticleUrl}
        entityType="article"
        disabled={saving || submitting || moderating || deleting}
        onSeoTitleChange={setSeoTitle}
        onSeoDescriptionChange={setSeoDescription}
        onCanonicalUrlChange={setSeoCanonicalUrl}
        onNoindexChange={setNoindex}
      />

      {/* Публикация */}
      <PublicationPanel
        views={views}
        saveStatusLabel={saveStatusLabel}
        status={status}
        onStatusChange={setStatus}
        scheduledAtLocal={scheduledAtLocal}
        publishedAtLocal={publishedAtLocal}
        onScheduledAtChange={setScheduledAtLocal}
        onPublishedAtChange={setPublishedAtLocal}
        authorUserId={authorUserId}
        onAuthorChange={setAuthorUserId}
        authorLabel={authorLabel}
        onAuthorLabelChange={setAuthorLabel}
        canModerate={canModerate}
        hasUnsavedChanges={dirty}
        actionsBusy={actionsBusy}
        submitting={submitting}
        saving={saving}
        moderating={moderating}
        onSubmitForModeration={() => void submitForModeration()}
        onSaveDraft={() => void save()}
        onApprove={() => void moderate("publish")}
        onReject={() => void moderate("reject")}
        previewHref={hasPersistedId ? `/preview/articles/${initial.id}` : null}
        publicUrl={publicUrl}
      />

      {/* Зона удаления (только для изолированных черновиков) */}
      {hasPersistedId && status === "DRAFT" ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-3 sm:py-4">
          <p className="text-sm text-muted-foreground mb-3">
            Удалить можно только полностью изолированный черновик. Если у статьи уже появились связанные данные,
            API вернёт блокировку и нужно будет использовать архивирование.
          </p>
          <Button
            type="button"
            variant="destructive"
            disabled={actionsBusy}
            onClick={() => setDeleteDialogOpen(true)}
          >
            Удалить черновик
          </Button>
        </div>
      ) : null}

      <AlertDialog open={leaveDialogOpen} onOpenChange={onLeaveDialogOpenChange}>
        <AlertDialogContent className="max-h-[92dvh] max-w-[calc(100%-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle>Несохранённые изменения</AlertDialogTitle>
            <AlertDialogDescription>
              Вы изменили статью. Уйти без сохранения? Несохранённые правки будут потеряны.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 [&_button]:min-h-11 sm:gap-0 sm:[&_button]:min-h-9">
            <AlertDialogCancel type="button">Остаться</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={confirmLeave}>
              Уйти без сохранения
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-h-[92dvh] max-w-[calc(100%-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить черновик?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Это действие нельзя отменить.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 [&_button]:min-h-11 sm:gap-0 sm:[&_button]:min-h-9">
            <AlertDialogCancel type="button" disabled={deleting}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteArticle();
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ContentSuccessModal
        open={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        state={successState}
      />
    </div>

    {everDirty ? (
      <ArticleEditorStickyBar
        status={stickyStatus}
        statusLabel={stickyStatusLabel}
        onSave={() => void save()}
        saveDisabled={actionsBusy || !dirty}
        approveAction={stickyApproveAction}
        saving={saving}
        previewHref={hasPersistedId ? `/preview/articles/${initial.id}` : null}
        publicUrl={publicUrl}
      />
    ) : null}
    </>
  );
}
