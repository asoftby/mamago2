"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ContentStatus, type GeoScope } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { ActivityCardEntityPicker } from "@/components/admin/articles/ActivityCardEntityPicker";
import { ArticleBlockRichEditor } from "@/components/admin/articles/ArticleBlockRichEditor";
import { ArticleEditorCoverField } from "@/components/admin/articles/ArticleEditorCoverField";
import { ArticleEditorGalleryField } from "@/components/admin/articles/ArticleEditorGalleryField";
import { CardMultiSelect } from "@/components/ui/card-multiselect";
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
import { validateArticleGeoScope } from "@/lib/article/articleGeoScopeValidation";
import { BreakingNewsLocalDraftBanner } from "@/components/admin/publications/BreakingNewsLocalDraftBanner";
import { useBreakingNewsLocalDraft } from "@/components/admin/publications/useBreakingNewsLocalDraft";
import {
  breakingNewsEditorComparable,
  clearBreakingNewsLocalDrafts,
  type BreakingNewsLocalDraft,
} from "@/lib/publications/breakingNewsLocalDraft";
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
import { ContentSuccessModal } from "@/components/shared/ContentSuccessModal";
import { resolveContentSuccessState } from "@/lib/content-success/resolver";
import type { ContentSuccessPayload, ResolvedContentSuccessState } from "@/lib/content-success/types";


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
  const [tagIds, setTagIds] = useState<string[]>([]);
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
  const [canModerate, setCanModerate] = useState(false);
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
  const [discoveryTags, setDiscoveryTags] = useState<
    { id: string; title: string; description: string | null; isActive: boolean }[]
  >([]);

  const [savedComparable, setSavedComparable] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successState, setSuccessState] = useState<ResolvedContentSuccessState | null>(null);
  const baselineSnapshotRef = useRef<ArticleEditorSnapshot | null>(null);
  const seoTitleManualRef = useRef(false);
  const seoDescriptionManualRef = useRef(false);
  const seoCanonicalManualRef = useRef(false);

  const formState = useMemo(
    (): BreakingNewsFormState => ({
      title,
      slug,
      tagIds,
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
      tagIds,
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
    () => breakingNewsEditorComparable({ ...formState, coverImagePreviewUrl }),
    [formState, coverImagePreviewUrl],
  );

  const dirty =
    savedComparable !== null && loadState === "ready" && currentComparable !== savedComparable;

  const applySnapshot = useCallback(
    (snap: ArticleEditorSnapshot) => {
      const p = parseBreakingNewsFromSnapshot(snap);
      onTitleChange(p.title);
      setSlug(p.slug);
      setPinnedSlug(snap.slug?.trim() || null);
      setTagIds(p.tagIds);
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
      seoTitleManualRef.current = Boolean(p.seoTitle.trim());
      seoDescriptionManualRef.current = Boolean(p.seoDescription.trim());
      seoCanonicalManualRef.current = Boolean(p.seoCanonicalUrl.trim());
      baselineSnapshotRef.current = snap;
      setSavedComparable(
        breakingNewsEditorComparable({
          ...p,
          coverImagePreviewUrl: snap.coverImageUrl ?? "",
        }),
      );
    },
    [onTitleChange],
  );

  const showSuccessModal = useCallback(
    (payload: Omit<ContentSuccessPayload, "surface" | "returnTo">) => {
      const next = resolveContentSuccessState({
        ...payload,
        surface: "admin",
      });
      if (!next) return;
      setSuccessState(next);
      setSuccessOpen(true);
    },
    [],
  );

  const applyLocalDraft = useCallback(
    (draft: BreakingNewsLocalDraft) => {
      onTitleChange(draft.title);
      setSlug(draft.slug);
      setTagIds(draft.tagIds);
      setCoverImageId(draft.coverImageId);
      setCoverImagePreviewUrl(draft.coverImagePreviewUrl);
      setGalleryIds(draft.galleryIds);
      setBodyHtml(draft.bodyHtml);
      setPricingHtml(draft.pricingHtml);
      setLinkedEntityType(draft.linkedEntityType);
      setLinkedEntityId(draft.linkedEntityId);
      setStatus(draft.status);
      setScheduledAtLocal(draft.scheduledAtLocal);
      setPublishedAtLocal(draft.publishedAtLocal);
      setSeoTitle(draft.seoTitle);
      setSeoDescription(draft.seoDescription);
      setSeoCanonicalUrl(draft.seoCanonicalUrl);
      setNoindex(draft.noindex);
      setAuthorUserId(draft.authorUserId);
      setAuthorError(null);
      setGeoScope(draft.geoScope);
      setCityId(draft.cityId);
      setGeoScopeError(null);
    },
    [onTitleChange],
  );

  const resetToBaseline = useCallback(() => {
    if (baselineSnapshotRef.current) {
      applySnapshot(baselineSnapshotRef.current);
    }
  }, [applySnapshot]);

  const {
    showDraftBanner,
    restoreDraft,
    discardDraft,
  } = useBreakingNewsLocalDraft({
    articleId,
    formState,
    coverImagePreviewUrl,
    loadState,
    savedComparable,
    onRestoreDraft: applyLocalDraft,
    onDiscardDraft: resetToBaseline,
  });

  const { leaveDialogOpen, confirmLeave, onLeaveDialogOpenChange } = useUnsavedChangesNavigationGuard(dirty);

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
      const selectedIds = tagIds.join(",");
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
      if (!articleId) {
        // Only set the default when geoScope is still null (unset by the empty snapshot).
        // The functional-update form prevents overwriting a geoScope that was already set.
        const minsk = data.cities?.find((c) => c.slug === "minsk");
        if (minsk) {
          setGeoScope((prev) => (prev === null ? "CITY" : prev));
          setCityId((prev) => (prev === null ? minsk.id : prev));
        }
      }
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [articleId, tagIds]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return;
      const u = (await res.json().catch(() => null)) as { id?: string; role?: string } | null;
      if (!cancelled && u?.role) {
        setCanModerate(u.role === "ADMIN" || u.role === "MODERATOR");
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
      tagIds: input.tagIds ?? [],
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

  const showBreakingNewsSuccess = useCallback(
    (
      outcome: ContentSuccessPayload["outcome"],
      id: string,
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
        kind: "breaking-news",
        outcome,
        id,
        isEdit,
        slug: source.slug ?? null,
        geoScope: source.geoScope ?? null,
        citySlug: modalCitySlug,
      });
    },
    [cities, cityId, geoScope, showSuccessModal, slug],
  );

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
          clearBreakingNewsLocalDrafts(snap.id);
          if (!opts?.silent) {
            showBreakingNewsSuccess("draft_saved", snap.id, snap, false);
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
        clearBreakingNewsLocalDrafts(snap.id);
        if (!opts?.silent) {
          showBreakingNewsSuccess("draft_saved", snap.id, snap, true);
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
    [
      articleId,
      applySnapshot,
      breakingNewsRequestBody,
      hasPersistedId,
      router,
      showBreakingNewsSuccess,
    ],
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
        endpoint: `/api/admin/articles/${id}/submit`,
      });
      const res = await fetch(`/api/admin/articles/${id}/submit`, { method: "POST" });
      submitPerf.log({ status: res.status, mode: "submit" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Не удалось отправить на модерацию";
        toast.error(msg);
        return;
      }
      const publishedSnap = data && typeof data === "object" && "id" in data
        ? (data as ArticleEditorSnapshot)
        : null;
      if (publishedSnap) {
        applySnapshot(publishedSnap);
      }
      clearBreakingNewsLocalDrafts(id);
      router.replace(`/admin/content/publications/new?type=news&id=${encodeURIComponent(id)}`);
      showBreakingNewsSuccess("submitted", id, publishedSnap, Boolean(articleId));
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
      const moderatedSnap = data && typeof data === "object" && "id" in data
        ? (data as ArticleEditorSnapshot)
        : null;
      if (moderatedSnap) {
        applySnapshot(moderatedSnap);
      }
      clearBreakingNewsLocalDrafts(id);
      router.replace(`/admin/content/publications/new?type=news&id=${encodeURIComponent(id)}`);
      if (action === "publish") {
        showBreakingNewsSuccess("published", id, moderatedSnap, true);
      } else {
        toast.success("Публикация отклонена");
      }
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
    slugLocked: hasPersistedId,
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

  useEffect(() => {
    if (loadState !== "ready" || seoTitleManualRef.current) return;
    setSeoTitle(generateBreakingNewsSeoTitle(title));
  }, [loadState, title]);

  useEffect(() => {
    if (loadState !== "ready" || seoDescriptionManualRef.current) return;
    setSeoDescription(generateBreakingNewsSeoDescription(bodyHtml));
  }, [bodyHtml, loadState]);

  useEffect(() => {
    if (loadState !== "ready" || seoCanonicalManualRef.current || !publicNewsUrl) return;
    setSeoCanonicalUrl(publicNewsUrl);
  }, [loadState, publicNewsUrl]);

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
      {showDraftBanner ? (
        <BreakingNewsLocalDraftBanner
          onRestore={restoreDraft}
          onDiscard={discardDraft}
          disabled={actionsBusy}
        />
      ) : null}
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
        <div className="space-y-2">
          <Label htmlFor="breaking-news-tags">Теги</Label>
          <p className="text-xs text-muted-foreground">
            Используются существующие активные Discovery теги. Создание новых тегов доступно только в админке Discovery.
          </p>
          <div id="breaking-news-tags">
            <CardMultiSelect
              placeholder="Выберите теги"
              values={tagIds}
              onChange={setTagIds}
              options={discoveryTags.map((tag) => ({
                value: tag.id,
                label: tag.isActive ? tag.title : `${tag.title} (выключен)`,
              }))}
              allowClear
              disabled={actionsBusy}
            />
          </div>
        </div>

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
          <Label>Стоимость</Label>
          <ArticleBlockRichEditor
            variant="text"
            value={pricingHtml}
            onChange={setPricingHtml}
            placeholder="Бесплатно, от 25,00 Br, уточняйте у организатора"
            minHeightClass="min-h-[200px]"
            disabled={actionsBusy}
          />
        </div>
        {/* TODO: Add optional Article.relatedPlaceId picker for editorial context (DB field already exists).
              Geography must remain controlled by the geo selector in Publication panel (geoScope/cityId),
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
        fallbackDescription={generateBreakingNewsSeoDescription(bodyHtml)}
        publicUrl={publicNewsUrl || undefined}
        entityType="breaking-news"
        disabled={actionsBusy}
        disableAutoFill
        onSeoTitleChange={(value) => {
          seoTitleManualRef.current = value.trim().length > 0;
          setSeoTitle(value);
        }}
        onSeoDescriptionChange={(value) => {
          seoDescriptionManualRef.current = value.trim().length > 0;
          setSeoDescription(value);
        }}
        onCanonicalUrlChange={(value) => {
          seoCanonicalManualRef.current = value.trim().length > 0;
          setSeoCanonicalUrl(value);
        }}
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
        canModerate={canModerate}
        hasUnsavedChanges={dirty}
        actionsBusy={actionsBusy}
        submitting={submitting}
        saving={saving}
        moderating={moderating}
        onSubmitForModeration={() => void submitForModeration()}
        onSaveDraft={() => void saveDraft()}
        onApprove={() => void moderate("publish")}
        onReject={() => void moderate("reject")}
        previewHref={previewHref}
        publicUrl={publicUrl}
        geoScope={geoScope}
        onGeoScopeChange={setGeoScope}
        cityId={cityId}
        onCityIdChange={setCityId}
        cities={cities}
        geoScopeError={geoScopeError}
        onGeoScopeErrorClear={() => setGeoScopeError(null)}
      />

      <ContentSuccessModal
        open={successOpen}
        onOpenChange={setSuccessOpen}
        state={successState}
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
