"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ContentStatus } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { ActivityCardEntityPicker } from "@/components/admin/articles/ActivityCardEntityPicker";
import { ArticleBlockRichEditor } from "@/components/admin/articles/ArticleBlockRichEditor";
import { ArticleEditorCoverField } from "@/components/admin/articles/ArticleEditorCoverField";
import { ArticleEditorGalleryField } from "@/components/admin/articles/ArticleEditorGalleryField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
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
import { SeoSectionFields } from "@/components/admin/publications/SeoFields";
import { ArticleBlocksEditor, ArticleTocToggle } from "@/components/admin/publications/ArticleBlocksEditor";
import { useHydrated } from "@/hooks/use-hydrated";
import { useUnsavedChangesNavigationGuard } from "@/hooks/use-unsaved-changes-navigation-guard";
import { PlaceLinkedContactsEditor } from "@/components/admin/publications/PlaceLinkedContactsEditor";
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

const CONTENT_STATUS_OPTIONS: ContentStatus[] = [
  "DRAFT",
  "PENDING",
  "PUBLISHED",
  "REJECTED",
  "SCHEDULED",
  "ARCHIVED",
];

const CONTENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На модерации",
  PUBLISHED: "Опубликовано",
  REJECTED: "Отклонено",
  SCHEDULED: "Запланировано",
  ARCHIVED: "В архиве",
};

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
  const hydrated = useHydrated();
  const hasPersistedId = Boolean(articleId?.trim());
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(() =>
    articleId ? "loading" : "ready",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notBreakingWarning, setNotBreakingWarning] = useState(false);
  const [coverImageId, setCoverImageId] = useState("");
  const [galleryIds, setGalleryIds] = useState<string[]>([]);
  const [slug, setSlug] = useState("");
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
      setCoverImageId(p.coverImageId);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return;
      const u = (await res.json().catch(() => null)) as { role?: string } | null;
      if (!cancelled && u?.role) {
        setIsAdminEditor(u.role === "ADMIN");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
          const res = await fetch("/api/admin/articles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
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
          router.refresh();
          return true;
        }

        const res = await fetch(`/api/admin/articles/${articleId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
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
        router.refresh();
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
    setSubmitting(true);
    setActionsBusy(true);
    try {
      let id = articleId?.trim() ?? "";
      if (!id) {
        const body = breakingNewsRequestBody();
        const res = await fetch("/api/admin/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
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

      const res = isAdminEditor
        ? await fetch(`/api/admin/articles/${id}/moderate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision: "publish" }),
          })
        : await fetch(`/api/admin/articles/${id}/submit`, { method: "POST" });
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
      const refresh = await fetch(`/api/admin/articles/${id}`);
      if (refresh.ok) {
        const snap = (await refresh.json()) as ArticleEditorSnapshot;
        applySnapshot(snap);
      }
      toast.success(isAdminEditor ? "Опубликовано" : "Отправлено на модерацию");
      router.replace(`/admin/content/publications/new?type=news&id=${encodeURIComponent(id)}`);
      router.refresh();
    } finally {
      setSubmitting(false);
      setActionsBusy(false);
    }
  };

  const moderate = async (action: "publish" | "reject") => {
    setModerating(true);
    setActionsBusy(true);
    try {
      let id = articleId?.trim() ?? "";
      if (!id) {
        const body = breakingNewsRequestBody();
        const res = await fetch("/api/admin/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
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

      const res = await fetch(`/api/admin/articles/${id}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Не удалось выполнить действие");
        return;
      }
      const refresh = await fetch(`/api/admin/articles/${id}`);
      if (refresh.ok) {
        const snap = (await refresh.json()) as ArticleEditorSnapshot;
        applySnapshot(snap);
      }
      toast.success(action === "publish" ? "Публикация одобрена" : "Публикация отклонена");
      router.replace(`/admin/content/publications/new?type=news&id=${encodeURIComponent(id)}`);
      router.refresh();
    } finally {
      setModerating(false);
      setActionsBusy(false);
    }
  };

  const publicBase = (process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by").replace(/\/$/, "");
  const slugPreviewPath = slug.trim() ? slug.trim() : "будет-сгенерирован-автоматически";
  const publicNewsUrl = `${publicBase}/blog/${slug.trim() || "…"}`;

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
            {publicNewsUrl}
            {!slug.trim() ? (
              <span className="block mt-1 text-amber-800">
                Путь «{slugPreviewPath}» — плейсхолдер; фактический slug появится после сохранения.
              </span>
            ) : null}
          </p>
        </div>
        <ArticleEditorCoverField value={coverImageId} onChange={(id) => setCoverImageId(id)} />
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
          <Label>Что по ценам?</Label>
          <ArticleBlockRichEditor
            variant="text"
            value={pricingHtml}
            onChange={setPricingHtml}
            placeholder="Цены, скидки, условия…"
            minHeightClass="min-h-[200px]"
          />
        </div>
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

      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">SEO</CardTitle>
          <CardDescription>
            Картинка для соцсетей и мессенджеров использует обложку новости (как в превью).
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
              <Label htmlFor="news-noindex" className="text-primary">
                Скрыть от поисковых систем
              </Label>
              <p className="text-xs text-muted-foreground leading-snug">
                Новость не будет индексироваться Google и не появится в поисковой выдаче.
              </p>
            </div>
            <Switch
              id="news-noindex"
              checked={noindex}
              onCheckedChange={(c) => setNoindex(c === true)}
              disabled={actionsBusy}
            />
          </div>
        </CardContent>
      </Card>

      {/* Публикация — как в редакторе статьи: статус, даты, действия */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Публикация</CardTitle>
          <CardDescription>Статус и даты · просмотры: {views}</CardDescription>
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
                    {CONTENT_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CONTENT_STATUS_LABEL[s] ?? s}
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
                onClick={() => void saveDraft()}
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
            <Button
              type="button"
              variant="outline"
              className="text-muted-foreground hover:text-foreground shrink-0"
              disabled
              title="Сохраните черновик — предпросмотр будет доступен после появления записи"
            >
              Предпросмотр
            </Button>
          </div>
        </CardContent>
      </Card>

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
      <SeoSectionFields titleId="article-seo-title" descId="article-seo-desc" />
    </div>
  );
}

export function CollectionPublicationEditor() {
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
      <SeoSectionFields titleId="coll-seo-title" descId="coll-seo-desc" />
    </div>
  );
}
