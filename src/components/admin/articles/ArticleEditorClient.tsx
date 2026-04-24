"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContentStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ArticleEditorSnapshot } from "@/lib/article/articleAdminTypes";
import type { ArticleContentPayload } from "@/lib/publications/articleMvp";
import { ArticleBlocksMvpEditor } from "@/components/admin/articles/ArticleBlocksMvpEditor";
import { ArticleEditorCoverField } from "@/components/admin/articles/ArticleEditorCoverField";
import { matchCitySlugFromContext } from "@/lib/article/articleEditorBasics";
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

const STATUS_OPTIONS: ContentStatus[] = [
  "DRAFT",
  "PENDING",
  "PUBLISHED",
  "REJECTED",
  "SCHEDULED",
  "ARCHIVED",
];

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На модерации",
  PUBLISHED: "Опубликовано",
  REJECTED: "Отклонено",
  SCHEDULED: "Запланировано",
  ARCHIVED: "В архиве",
};

function statusBadgeClass(s: ContentStatus): string {
  switch (s) {
    case "PUBLISHED":
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    case "PENDING":
      return "bg-amber-100 text-amber-900 border-amber-200";
    case "DRAFT":
      return "bg-slate-100 text-slate-800 border-slate-200";
    case "REJECTED":
      return "bg-red-100 text-red-900 border-red-200";
    case "SCHEDULED":
      return "bg-sky-100 text-sky-900 border-sky-200";
    case "ARCHIVED":
      return "bg-gray-200 text-gray-800 border-gray-300";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

function toLocalDatetimeValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeValue(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function snapshotComparable(args: {
  title: string;
  slug: string;
  excerpt: string;
  coverImageId: string;
  authorUserId: string;
  authorLabel: string;
  cityContext: string;
  content: ArticleContentPayload;
  status: ContentStatus;
  publishedAtLocal: string;
  scheduledAtLocal: string;
  seoTitle: string;
  seoDescription: string;
  seoCanonicalUrl: string;
  noindex: boolean;
}): string {
  return JSON.stringify(args);
}

function applySnapshot(setters: {
  setTitle: (v: string) => void;
  setSlug: (v: string) => void;
  setExcerpt: (v: string) => void;
  setCoverImageId: (v: string) => void;
  setAuthorUserId: (v: string) => void;
  setAuthorLabel: (v: string) => void;
  setCityContext: (v: string) => void;
  setContent: (v: ArticleContentPayload) => void;
  setStatus: (v: ContentStatus) => void;
  setPublishedAtLocal: (v: string) => void;
  setScheduledAtLocal: (v: string) => void;
  setSeoTitle: (v: string) => void;
  setSeoDescription: (v: string) => void;
  setSeoCanonicalUrl: (v: string) => void;
  setNoindex: (v: boolean) => void;
  setViews: (v: number) => void;
}, snap: ArticleEditorSnapshot) {
  setters.setTitle(snap.title);
  setters.setSlug(snap.slug ?? "");
  setters.setExcerpt(snap.excerpt ?? "");
  setters.setCoverImageId(snap.coverImageId ?? "");
  setters.setAuthorUserId(snap.authorUserId ?? "");
  setters.setAuthorLabel(snap.authorLabel ?? "");
  setters.setCityContext(snap.cityContext ?? "");
  setters.setContent(snap.content);
  setters.setStatus(snap.status);
  setters.setPublishedAtLocal(toLocalDatetimeValue(snap.publishedAt));
  setters.setScheduledAtLocal(toLocalDatetimeValue(snap.scheduledAt));
  setters.setSeoTitle(snap.seoTitle ?? "");
  setters.setSeoDescription(snap.seoDescription ?? "");
  setters.setSeoCanonicalUrl(snap.seoCanonicalUrl ?? "");
  setters.setNoindex(snap.noindex);
  setters.setViews(snap.views);
}

export function ArticleEditorClient({
  initial,
  isAdminEditor = false,
}: {
  initial: ArticleEditorSnapshot;
  /** ADMIN: кнопка «Опубликовать» и прямой publish; MODERATOR: «Отправить на модерацию». */
  isAdminEditor?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [moderating, setModerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [views, setViews] = useState(initial.views);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(() => {
    const t = Date.parse(initial.updatedAt);
    return Number.isNaN(t) ? null : t;
  });
  const [saveHintTick, setSaveHintTick] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug ?? "");
  const [excerpt, setExcerpt] = useState(initial.excerpt ?? "");
  const [coverImageId, setCoverImageId] = useState(initial.coverImageId ?? "");
  const [authorUserId, setAuthorUserId] = useState(initial.authorUserId ?? "");
  const [authorLabel, setAuthorLabel] = useState(initial.authorLabel ?? "");
  const [cityContext, setCityContext] = useState(initial.cityContext ?? "");
  const [cities, setCities] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [authors, setAuthors] = useState<{ id: string; label: string; email: string }[]>([]);
  const [content, setContent] = useState<ArticleContentPayload>(initial.content);
  const [status, setStatus] = useState<ContentStatus>(initial.status);
  const [publishedAtLocal, setPublishedAtLocal] = useState(toLocalDatetimeValue(initial.publishedAt));
  const [scheduledAtLocal, setScheduledAtLocal] = useState(toLocalDatetimeValue(initial.scheduledAt));
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription ?? "");
  const [seoCanonicalUrl, setSeoCanonicalUrl] = useState(initial.seoCanonicalUrl ?? "");
  const [noindex, setNoindex] = useState(initial.noindex);

  const hydrated = useHydrated();

  /** Запись в БД ещё не создана — только после первого «Сохранить» / «Опубликовать». */
  const hasPersistedId = Boolean(initial.id?.trim());

  const savedComparableRef = useRef(
    snapshotComparable({
      title: initial.title,
      slug: initial.slug ?? "",
      excerpt: initial.excerpt ?? "",
      coverImageId: initial.coverImageId ?? "",
      authorUserId: initial.authorUserId ?? "",
      authorLabel: initial.authorLabel ?? "",
      cityContext: initial.cityContext ?? "",
      content: initial.content,
      status: initial.status,
      publishedAtLocal: toLocalDatetimeValue(initial.publishedAt),
      scheduledAtLocal: toLocalDatetimeValue(initial.scheduledAt),
      seoTitle: initial.seoTitle ?? "",
      seoDescription: initial.seoDescription ?? "",
      seoCanonicalUrl: initial.seoCanonicalUrl ?? "",
      noindex: initial.noindex,
    }),
  );

  const currentComparable = useMemo(
    () =>
      snapshotComparable({
        title,
        slug,
        excerpt,
        coverImageId,
        authorUserId,
        authorLabel,
        cityContext,
        content,
        status,
        publishedAtLocal,
        scheduledAtLocal,
        seoTitle,
        seoDescription,
        seoCanonicalUrl,
        noindex,
      }),
    [
      title,
      slug,
      excerpt,
      coverImageId,
      authorUserId,
      authorLabel,
      cityContext,
      content,
      status,
      publishedAtLocal,
      scheduledAtLocal,
      seoTitle,
      seoDescription,
      seoCanonicalUrl,
      noindex,
    ],
  );

  const dirty = currentComparable !== savedComparableRef.current;

  const { leaveDialogOpen, confirmLeave, onLeaveDialogOpenChange } = useUnsavedChangesNavigationGuard(dirty);

  useEffect(() => {
    const id = window.setInterval(() => setSaveHintTick((n) => n + 1), 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/articles/editor-options");
      if (!res.ok || cancelled) return;
      const data = (await res.json().catch(() => null)) as {
        cities?: { id: string; name: string; slug: string }[];
        authors?: { id: string; label: string; email: string }[];
      } | null;
      if (!data || cancelled) return;
      setCities(data.cities ?? []);
      setAuthors(data.authors ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const publicBase = (process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by").replace(/\/$/, "");
  const slugPreviewPath = slug.trim() ? slug.trim() : "будет-сгенерирован-автоматически";
  const publicArticleUrl = `${publicBase}/blog/${slug.trim() || "…"}`;

  const citySlugForSelect = matchCitySlugFromContext(cityContext, cities);
  const cityContextNotInCatalog =
    !!cityContext.trim() && cities.length > 0 && !citySlugForSelect;

  const authorsForSelect = useMemo(() => {
    const id = authorUserId.trim();
    if (!id || authors.some((a) => a.id === id)) return authors;
    return [{ id, label: "Текущий автор (нет в списке)", email: "" }, ...authors];
  }, [authors, authorUserId]);

  const payload = useMemo(
    () => ({
      title,
      slug: slug.trim() || null,
      subtitle: null as string | null,
      excerpt: excerpt.trim() || null,
      content,
      coverImageId: coverImageId.trim() || null,
      authorLabel: authorLabel.trim() || null,
      authorUserId: authorUserId.trim() || null,
      cityContext: cityContext.trim() || null,
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
    }),
    [
      title,
      slug,
      excerpt,
      content,
      coverImageId,
      authorLabel,
      authorUserId,
      cityContext,
      status,
      publishedAtLocal,
      scheduledAtLocal,
      seoTitle,
      seoDescription,
      seoCanonicalUrl,
      noindex,
    ],
  );

  const persistComparableFromSnapshot = useCallback((snap: ArticleEditorSnapshot) => {
    savedComparableRef.current = snapshotComparable({
      title: snap.title,
      slug: snap.slug ?? "",
      excerpt: snap.excerpt ?? "",
      coverImageId: snap.coverImageId ?? "",
      authorUserId: snap.authorUserId ?? "",
      authorLabel: snap.authorLabel ?? "",
      cityContext: snap.cityContext ?? "",
      content: snap.content,
      status: snap.status,
      publishedAtLocal: toLocalDatetimeValue(snap.publishedAt),
      scheduledAtLocal: toLocalDatetimeValue(snap.scheduledAt),
      seoTitle: snap.seoTitle ?? "",
      seoDescription: snap.seoDescription ?? "",
      seoCanonicalUrl: snap.seoCanonicalUrl ?? "",
      noindex: snap.noindex,
    });
  }, []);

  const save = useCallback(
    async (opts?: { silent?: boolean; skipLoading?: boolean }): Promise<boolean> => {
      if (!opts?.skipLoading) setSaving(true);
      setError(null);
      try {
        if (!hasPersistedId) {
          const res = await fetch("/api/admin/articles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
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
          applySnapshot(
            {
              setTitle,
              setSlug,
              setExcerpt,
              setCoverImageId,
              setAuthorUserId,
              setAuthorLabel,
              setCityContext,
              setContent,
              setStatus,
              setPublishedAtLocal,
              setScheduledAtLocal,
              setSeoTitle,
              setSeoDescription,
              setSeoCanonicalUrl,
              setNoindex,
              setViews,
            },
            next,
          );
          persistComparableFromSnapshot(next);
          const updated = Date.parse(next.updatedAt);
          if (!Number.isNaN(updated)) setLastSavedAt(updated);
          else setLastSavedAt(Date.now());
          if (!opts?.silent) {
            toast.success("Черновик сохранён");
          }
          router.replace(`/admin/content/articles/${next.id}/edit`);
          router.refresh();
          return true;
        }

        const res = await fetch(`/api/admin/articles/${initial.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
        applySnapshot(
          {
            setTitle,
            setSlug,
            setExcerpt,
            setCoverImageId,
            setAuthorUserId,
            setAuthorLabel,
            setCityContext,
            setContent,
            setStatus,
            setPublishedAtLocal,
            setScheduledAtLocal,
            setSeoTitle,
            setSeoDescription,
            setSeoCanonicalUrl,
            setNoindex,
            setViews,
          },
          next,
        );
        persistComparableFromSnapshot(next);
        const updated = Date.parse(next.updatedAt);
        if (!Number.isNaN(updated)) setLastSavedAt(updated);
        else setLastSavedAt(Date.now());
        if (!opts?.silent) {
          toast.success("Черновик сохранён");
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
    [hasPersistedId, initial.id, payload, persistComparableFromSnapshot, router],
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
    setSubmitting(true);
    try {
      let articleId = initial.id.trim();

      if (!articleId) {
        setError(null);
        const res = await fetch("/api/admin/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
        applySnapshot(
          {
            setTitle,
            setSlug,
            setExcerpt,
            setCoverImageId,
            setAuthorUserId,
            setAuthorLabel,
            setCityContext,
            setContent,
            setStatus,
            setPublishedAtLocal,
            setScheduledAtLocal,
            setSeoTitle,
            setSeoDescription,
            setSeoCanonicalUrl,
            setNoindex,
            setViews,
          },
          created,
        );
        persistComparableFromSnapshot(created);
      } else {
        const ok = await save({ silent: true, skipLoading: true });
        if (!ok) return;
      }

      const res = isAdminEditor
        ? await fetch(`/api/admin/articles/${articleId}/moderate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision: "publish" }),
          })
        : await fetch(`/api/admin/articles/${articleId}/submit`, { method: "POST" });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          typeof data.error === "string"
            ? data.error
            : isAdminEditor
              ? "Не удалось опубликовать"
              : "Не удалось отправить на модерацию";
        setError(msg);
        toast.error(msg);
        return;
      }
      const next = await fetchSnapshot(articleId);
      if (next) {
        applySnapshot(
          {
            setTitle,
            setSlug,
            setExcerpt,
            setCoverImageId,
            setAuthorUserId,
            setAuthorLabel,
            setCityContext,
            setContent,
            setStatus,
            setPublishedAtLocal,
            setScheduledAtLocal,
            setSeoTitle,
            setSeoDescription,
            setSeoCanonicalUrl,
            setNoindex,
            setViews,
          },
          next,
        );
        persistComparableFromSnapshot(next);
        const updated = Date.parse(next.updatedAt);
        if (!Number.isNaN(updated)) setLastSavedAt(updated);
      }
      toast.success(isAdminEditor ? "Статья опубликована" : "Отправлено на модерацию");
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
    isAdminEditor,
  ]);

  const moderate = useCallback(
    async (decision: "publish" | "reject") => {
      setError(null);
      setModerating(true);
      try {
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
          applySnapshot(
            {
              setTitle,
              setSlug,
              setExcerpt,
              setCoverImageId,
              setAuthorUserId,
              setAuthorLabel,
              setCityContext,
              setContent,
              setStatus,
              setPublishedAtLocal,
              setScheduledAtLocal,
              setSeoTitle,
              setSeoDescription,
              setSeoCanonicalUrl,
              setNoindex,
              setViews,
            },
            next,
          );
          persistComparableFromSnapshot(next);
          const updated = Date.parse(next.updatedAt);
          if (!Number.isNaN(updated)) setLastSavedAt(updated);
        }
        toast.success(decision === "publish" ? "Статья опубликована" : "Статья отклонена");
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Ошибка модерации";
        toast.error(msg);
      } finally {
        setModerating(false);
      }
    },
    [initial.id, fetchSnapshot, persistComparableFromSnapshot, router],
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

  const saveStatusLabel = useMemo(() => {
    if (dirty) {
      return "Изменения не сохранены";
    }
    if (lastSavedAt != null) {
      return `Сохранено ${formatDistanceToNow(lastSavedAt, { addSuffix: true, locale: ru })}`;
    }
    return null;
  }, [dirty, lastSavedAt, saveHintTick]);

  return (
    <div className="p-6 md:p-4 space-y-8 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3 gap-y-2">
        <div className="min-w-0 flex-1 pr-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">Статья</p>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900 line-clamp-3 break-words">
            {title.trim() || "Без названия"}
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
        <CardHeader>
          <CardTitle className="text-lg">Основная информация</CardTitle>
          <CardDescription>
            Заголовок, адрес страницы, лид, обложка, автор и городской контекст
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Заголовок</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <p className="text-xs text-muted-foreground">
              Если оставить пустым, slug будет сгенерирован из заголовка при сохранении (один раз). Ниже —
              предпросмотр публичного URL.
            </p>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="font-mono text-sm"
              placeholder="например: semeynyy-vykhod-v-minsk"
            />
            <p className="text-xs text-gray-500 break-all">
              <span className="font-medium text-gray-700">Публичный URL: </span>
              {publicArticleUrl}
              {!slug.trim() ? (
                <span className="block mt-1 text-amber-800">
                  Путь «{slugPreviewPath}» — плейсхолдер; фактический slug появится после сохранения.
                </span>
              ) : null}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Краткое описание для превью</Label>
            <Textarea rows={3} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
          </div>

          <ArticleEditorCoverField
            value={coverImageId}
            initialPreviewUrl={initial.coverImageUrl}
            onChange={(id) => {
              setCoverImageId(id);
            }}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="article-author">Автор</Label>
              {hydrated ? (
                <Select
                  value={authorUserId.trim() ? authorUserId : "__none__"}
                  onValueChange={(v) => setAuthorUserId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger id="article-author" className="w-full">
                    <SelectValue placeholder="Выберите автора" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Не указан</SelectItem>
                    {authorsForSelect.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.email ? `${a.label} (${a.email})` : a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div
                  id="article-author"
                  className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground animate-pulse"
                  aria-hidden
                >
                  …
                </div>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="article-author-label">Отображаемое имя автора</Label>
              <Input
                id="article-author-label"
                value={authorLabel}
                onChange={(e) => setAuthorLabel(e.target.value)}
                placeholder="Необязательно: подпись на сайте вместо имени пользователя"
              />
              <p className="text-xs text-muted-foreground">
                Если пусто, на сайте показывается имя выбранного пользователя.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="article-city">Город</Label>
              {hydrated ? (
                <Select
                  value={citySlugForSelect || "__none__"}
                  onValueChange={(v) => {
                    if (v === "__none__") setCityContext("");
                    else setCityContext(v);
                  }}
                >
                  <SelectTrigger id="article-city" className="w-full">
                    <SelectValue placeholder="Выберите город" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Без привязки к городу</SelectItem>
                    {cities.map((c) => (
                      <SelectItem key={c.id} value={c.slug}>
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
              {cityContextNotInCatalog ? (
                <p className="text-xs text-amber-800">
                  Сохранённое значение не совпало со справочником. Выберите город из списка или сбросьте
                  привязку.
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Контент */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Контент статьи</CardTitle>
          <CardDescription>Блоки в фиксированном порядке</CardDescription>
        </CardHeader>
        <CardContent>
          <ArticleBlocksMvpEditor
            blocks={content.blocks}
            onChange={(blocks) => setContent((prev) => ({ ...prev, blocks }))}
          />
        </CardContent>
      </Card>

      {/* SEO */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">SEO</CardTitle>
          <CardDescription>
            Картинка для соцсетей и мессенджеров использует обложку статьи (как в превью).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>SEO title</Label>
            <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>SEO description</Label>
            <Textarea rows={3} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Canonical URL</Label>
            <Input value={seoCanonicalUrl} onChange={(e) => setSeoCanonicalUrl(e.target.value)} />
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 min-w-0">
              <Label htmlFor="article-noindex" className="text-primary">
                Скрыть от поисковых систем
              </Label>
              <p className="text-xs text-muted-foreground leading-snug">
                Статья не будет индексироваться Google и не появится в поисковой выдаче.
              </p>
            </div>
            <Switch
              id="article-noindex"
              checked={noindex}
              onCheckedChange={(c) => setNoindex(c === true)}
              disabled={actionsBusy}
            />
          </div>
        </CardContent>
      </Card>

      {/* Публикация — в конце формы: статус, даты, сохранение и модерация */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Публикация</CardTitle>
          <CardDescription>
            Просмотры: {views}
            {saveStatusLabel ? (
              <span className="ml-2">· {saveStatusLabel}</span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Статус</Label>
              {hydrated ? (
                <Select value={status} onValueChange={(v) => setStatus(v as ContentStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s] ?? s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div
                  className="flex h-9 min-w-[10rem] items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground animate-pulse"
                  aria-hidden
                >
                  …
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Запланировано (scheduledAt)</Label>
              <Input
                type="datetime-local"
                value={scheduledAtLocal}
                onChange={(e) => setScheduledAtLocal(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Опубликовано (publishedAt)</Label>
              <Input
                type="datetime-local"
                value={publishedAtLocal}
                onChange={(e) => setPublishedAtLocal(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-2 pt-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <Button
                type="button"
                variant="default"
                onClick={() => void submitForModeration()}
                disabled={actionsBusy}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {isAdminEditor ? "Опубликовать" : "Отправить на модерацию"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => void save()}
                disabled={actionsBusy}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Сохранить черновик
              </Button>
              {status === "PENDING" ? (
                <>
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => void moderate("publish")}
                    disabled={actionsBusy}
                  >
                    {moderating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    Одобрить (опубликовать)
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void moderate("reject")}
                    disabled={actionsBusy}
                  >
                    {moderating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    Отклонить
                  </Button>
                </>
              ) : null}
            </div>
            {hasPersistedId ? (
              <Button
                type="button"
                variant="outline"
                className="text-muted-foreground hover:text-foreground shrink-0"
                asChild
              >
                <Link href={`/preview/articles/${initial.id}`} target="_blank" rel="noopener noreferrer">
                  Предпросмотр
                </Link>
              </Button>
            ) : null}
          </div>
          {hasPersistedId && (status === "ARCHIVED" || status === "DRAFT") ? (
            <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-3 sm:py-4 mt-4">
              <p className="text-sm text-muted-foreground mb-3">
                {status === "DRAFT"
                  ? "Удалить черновик — запись исчезнет из списка публикаций. Пока статья не опубликована, публичных страниц нет."
                  : "Удаление навсегда убирает статью из базы. Публичная страница вернёт 404. Доступно только для архивных материалов."}
              </p>
              <Button
                type="button"
                variant="destructive"
                disabled={actionsBusy}
                onClick={() => setDeleteDialogOpen(true)}
              >
                {status === "DRAFT" ? "Удалить черновик" : "Удалить"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog open={leaveDialogOpen} onOpenChange={onLeaveDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Несохранённые изменения</AlertDialogTitle>
            <AlertDialogDescription>
              Вы изменили статью. Уйти без сохранения? Несохранённые правки будут потеряны.
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удаление статьи</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Вы уверены, что хотите удалить статью?</p>
                <p>Это действие нельзя отменить.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
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
    </div>
  );
}
