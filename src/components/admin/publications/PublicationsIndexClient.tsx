"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { BarChart2, ChevronRight, Eye, Loader2, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  PublicationStatus,
  PublicationTabFilter,
  PublicationType,
  type PublicationListRow,
} from "@/lib/publications/domain";
import { PUBLICATION_STATUS_LABEL, PUBLICATION_TYPE_LABEL } from "@/lib/publications/labels";
import { PublicationStatsDrawer } from "./PublicationStatsDrawer";
import type { PublicationStatsDrawerProps } from "./PublicationStatsDrawer";
import { resolveContentLinks } from "@/lib/content-success/resolver";

function matchesTab(row: PublicationListRow, tab: PublicationTabFilter): boolean {
  if (tab === PublicationTabFilter.ALL) return true;
  return row.type === tab;
}

/** Статья или Breaking news (обе в `Article`); подборки в этом списке не приходят. */
function publicationEditHref(row: PublicationListRow): string | null {
  if (row.type === PublicationType.ARTICLE) {
    return `/admin/content/articles/${row.id}/edit`;
  }
  if (row.type === PublicationType.NEWS) {
    return `/admin/content/publications/new?type=news&id=${encodeURIComponent(row.id)}`;
  }
  return null;
}

function hasArticleLikeActions(row: PublicationListRow): boolean {
  return row.type === PublicationType.ARTICLE || row.type === PublicationType.NEWS;
}

function resolveArticleLikeLinks(row: PublicationListRow) {
  return resolveContentLinks({
    kind: row.type === PublicationType.NEWS ? "breaking-news" : "article",
    surface: "admin",
    outcome: "published",
    id: row.id,
    slug: row.slug,
    geoScope: row.geoScope ?? null,
    citySlug: row.citySlug ?? null,
  });
}

function statusBadgeClass(s: PublicationStatus): string {
  switch (s) {
    case PublicationStatus.PUBLISHED:
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    case PublicationStatus.PENDING:
      return "bg-amber-100 text-amber-900 border-amber-200";
    case PublicationStatus.DRAFT:
      return "bg-slate-100 text-slate-800 border-slate-200";
    case PublicationStatus.REJECTED:
      return "bg-red-100 text-red-900 border-red-200";
    case PublicationStatus.SCHEDULED:
      return "bg-sky-100 text-sky-900 border-sky-200";
    case PublicationStatus.ARCHIVED:
      return "bg-gray-200 text-gray-800 border-gray-300";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

type SortKey = "updatedAt_desc" | "publishedAt_desc" | "title_asc";

const SORT_LABEL: Record<SortKey, string> = {
  updatedAt_desc: "Обновлено (сначала новые)",
  publishedAt_desc: "Дата публикации (сначала новые)",
  title_asc: "Заголовок (А→Я)",
};

export function PublicationsIndexClient({
  initialRows,
  cities,
}: {
  initialRows: PublicationListRow[];
  cities: { id: string; name: string; slug: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<PublicationTabFilter>(PublicationTabFilter.ALL);
  const [status, setStatus] = useState<string>("all");
  /** id пользователя-автора; пусто = все (как справочник в редакторе статьи) */
  const [authorUserIdFilter, setAuthorUserIdFilter] = useState("");
  const [authorOptions, setAuthorOptions] = useState<
    { id: string; label: string; email: string }[]
  >([]);
  /** id города из справочника или "" — все города */
  const [cityId, setCityId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [typeQuick, setTypeQuick] = useState<"all" | "ARTICLE">("all");
  const [sort, setSort] = useState<SortKey>("updatedAt_desc");
  const [titleSearch, setTitleSearch] = useState("");
  const [quickNoCover, setQuickNoCover] = useState(false);
  const [quickNoSlug, setQuickNoSlug] = useState(false);
  const [quickDrafts, setQuickDrafts] = useState(false);
  const [quickPublished, setQuickPublished] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
    isDraft: boolean;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Drawer статистики
  const [statsDrawer, setStatsDrawer] = useState<PublicationStatsDrawerProps["publication"] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/articles/editor-options");
        if (!res.ok || cancelled) return;
        const data = (await res.json().catch(() => null)) as {
          authors?: { id: string; label: string; email: string }[];
        } | null;
        if (!data?.authors || cancelled) return;
        setAuthorOptions(data.authors);
      } catch (error) {
        if (cancelled) return;
        console.warn(
          "[PublicationsIndexClient] failed to load article editor options",
          error,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cityNameFilter = useMemo(() => {
    if (!cityId) return "";
    return cities.find((c) => c.id === cityId)?.name?.trim() ?? "";
  }, [cityId, cities]);

  const filtered = useMemo(() => {
    const q = titleSearch.trim().toLowerCase();
    return initialRows.filter((row) => {
      if (!matchesTab(row, tab)) return false;
      if (tab === PublicationTabFilter.ALL && typeQuick === "ARTICLE" && row.type !== PublicationType.ARTICLE) {
        return false;
      }
      if (q && !row.title.toLowerCase().includes(q)) return false;
      if (quickNoCover && row.hasCover) return false;
      if (quickNoSlug && row.hasSlug) return false;
      if (quickDrafts && row.status !== PublicationStatus.DRAFT) return false;
      if (quickPublished && row.status !== PublicationStatus.PUBLISHED) return false;
      if (status !== "all" && row.status !== status) return false;
      if (authorUserIdFilter && row.authorUserId !== authorUserIdFilter) {
        return false;
      }
      if (
        cityNameFilter &&
        !row.cityOrContext.toLowerCase().includes(cityNameFilter.toLowerCase())
      ) {
        return false;
      }
      if (dateFrom && row.updatedAt < `${dateFrom}T00:00:00.000Z`) return false;
      return true;
    });
  }, [
    initialRows,
    tab,
    status,
    authorUserIdFilter,
    cityNameFilter,
    dateFrom,
    typeQuick,
    titleSearch,
    quickNoCover,
    quickNoSlug,
    quickDrafts,
    quickPublished,
  ]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sort) {
        case "updatedAt_desc":
          return b.updatedAt.localeCompare(a.updatedAt);
        case "publishedAt_desc": {
          const ap = a.publishedAt || "";
          const bp = b.publishedAt || "";
          const empty = "1970-01-01T00:00:00.000Z";
          return (bp || empty).localeCompare(ap || empty);
        }
        case "title_asc":
          return a.title.localeCompare(b.title, "ru");
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sort]);

  /** Пустой список: куда вести «Создать публикацию» — по текущей вкладке */
  const emptyListCreate = useMemo(() => {
    switch (tab) {
      case PublicationTabFilter.NEWS:
        return {
          hint: "Создайте Breaking news — откроется редактор, черновик сохранится в БД.",
          path: "/admin/content/publications/new?type=news",
        };
      case PublicationTabFilter.ARTICLE:
        return {
          hint: "Создайте статью — откроется редактор с блоками, черновик сохранится в БД.",
          path: "/admin/content/articles/new",
        };
      case PublicationTabFilter.COLLECTION:
        return {
          hint: "Создайте подборку — откроется редактор (foundation, без сохранения на сервер).",
          path: "/admin/content/publications/new?type=collection",
        };
      case PublicationTabFilter.ALL:
        return {
          hint: "На следующей странице выберите формат: новость, статью или подборку.",
          path: "/admin/content/publications/new",
        };
    }
  }, [tab]);

  /** Публичный путь публикации для запроса статистики */
  function publicationPath(row: PublicationListRow): string {
    const { publicUrl } = resolveArticleLikeLinks(row);
    if (publicUrl) {
      return new URL(publicUrl).pathname;
    }
    return `/publications/${row.id}`;
  }

  const openStatsDrawer = (row: PublicationListRow) => {
    setStatsDrawer({
      id: row.id,
      title: row.title,
      type: row.type,
      status: row.status,
      slug: row.slug,
      path: publicationPath(row),
      updatedAt: row.updatedAt,
    });
  };

  const confirmDeleteArticle = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      const res = await fetch(`/api/admin/articles/${deleteTarget.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        const msg =
          typeof data.message === "string"
            ? data.message
            : typeof data.error === "string"
              ? data.error
              : "Не удалось удалить статью";
        toast.error(msg);
        return;
      }
      toast.success("Статья удалена");
      setDeleteTarget(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeletingId(null);
    }
  };

  const confirmArchivePublication = async () => {
    if (!archiveTarget) return;

    setArchivingId(archiveTarget.id);
    try {
      const res = await fetch(`/api/admin/articles/${archiveTarget.id}/archive`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = typeof data.error === "string" ? data.error : "Не удалось архивировать";
        toast.error(msg);
        return;
      }
      toast.success("Публикация перенесена в архив");
      setArchiveTarget(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setArchivingId(null);
    }
  };

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollHint, setTableScrollHint] = useState<"none" | "right" | "left" | "both">("none");

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) {
      setTableScrollHint("none");
      return;
    }

    const update = () => {
      if (typeof window === "undefined") return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const overflow = scrollWidth > clientWidth + 2;
      if (!overflow) {
        setTableScrollHint("none");
        return;
      }
      const atStart = scrollLeft <= 2;
      const atEnd = scrollLeft + clientWidth >= scrollWidth - 2;
      if (atStart && !atEnd) setTableScrollHint("right");
      else if (!atStart && atEnd) setTableScrollHint("left");
      else if (!atStart && !atEnd) setTableScrollHint("both");
      else setTableScrollHint("none");
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sorted.length]);

  return (
    <div className="p-6 md:p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Публикации</h1>
          <p className="text-sm text-gray-600 mt-1">
            Материалы редакции: статьи, новости и подборки
          </p>
        </div>
      </div>

      {/* ── Drawer статистики ── */}
      {statsDrawer && (
        <PublicationStatsDrawer
          open={statsDrawer !== null}
          onOpenChange={(open) => { if (!open) setStatsDrawer(null); }}
          publication={statsDrawer}
        />
      )}

      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архивировать публикацию?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Публикация будет убрана из публичной выдачи и перемещена в архив.</p>
                {archiveTarget?.title ? (
                  <p className="font-medium text-foreground">«{archiveTarget.title}»</p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Отмена</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={archivingId !== null}
              onClick={(e) => {
                e.preventDefault();
                void confirmArchivePublication();
              }}
            >
              {archivingId ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Архивировать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.isDraft ? "Удалить черновик?" : "Удаление статьи"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {deleteTarget?.isDraft
                    ? "Черновик будет удалён из базы. Это не затрагивает уже опубликованные материалы."
                    : "Вы уверены, что хотите удалить статью?"}
                </p>
                {!deleteTarget?.isDraft ? <p>Это действие нельзя отменить.</p> : null}
                {deleteTarget?.title ? (
                  <p className="font-medium text-foreground">«{deleteTarget.title}»</p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Отмена</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deletingId !== null}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteArticle();
              }}
            >
              {deletingId ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as PublicationTabFilter)}
        className="min-w-0 space-y-3"
      >
        <div className="overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin]">
          <TabsList className="inline-flex h-auto w-max min-w-0 gap-1 justify-start rounded-xl bg-gray-100/80 p-1 sm:w-full sm:flex-wrap">
            <TabsTrigger value={PublicationTabFilter.ALL} className="rounded-lg shrink-0">
              Все
            </TabsTrigger>
            <TabsTrigger value={PublicationTabFilter.NEWS} className="rounded-lg shrink-0">
              Новости
            </TabsTrigger>
            <TabsTrigger value={PublicationTabFilter.ARTICLE} className="rounded-lg shrink-0">
              Статьи
            </TabsTrigger>
            <TabsTrigger value={PublicationTabFilter.COLLECTION} className="rounded-lg shrink-0">
              Подборки
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      <div className="min-w-0 space-y-4">
        <div className="w-full min-w-0 sm:max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="publications-title-search">
            Поиск по заголовку
          </label>
          <Input
            id="publications-title-search"
            placeholder="Начните вводить…"
            value={titleSearch}
            onChange={(e) => setTitleSearch(e.target.value)}
            className="w-full min-w-0"
          />
        </div>
        <div className="flex flex-nowrap sm:flex-wrap gap-2 overflow-x-auto overscroll-x-contain pb-1 sm:pb-0 sm:overflow-visible [scrollbar-width:thin]">
          <Button
            type="button"
            variant={quickNoCover ? "secondary" : "outline"}
            size="sm"
            className="h-8 shrink-0 text-xs"
            onClick={() => setQuickNoCover((v) => !v)}
          >
            Без обложки
          </Button>
          <Button
            type="button"
            variant={quickNoSlug ? "secondary" : "outline"}
            size="sm"
            className="h-8 shrink-0 text-xs"
            onClick={() => setQuickNoSlug((v) => !v)}
          >
            Без slug
          </Button>
          <Button
            type="button"
            variant={quickDrafts ? "secondary" : "outline"}
            size="sm"
            className="h-8 shrink-0 text-xs"
            onClick={() => setQuickDrafts((v) => !v)}
          >
            Черновики
          </Button>
          <Button
            type="button"
            variant={quickPublished ? "secondary" : "outline"}
            size="sm"
            className="h-8 shrink-0 text-xs"
            onClick={() => setQuickPublished((v) => !v)}
          >
            Опубликованные
          </Button>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&>*]:min-w-0">
          <div className="min-w-0">
            <span className="block text-sm font-medium text-gray-700 mb-1">Статус</span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              {Object.values(PublicationStatus).map((s) => (
                <SelectItem key={s} value={s}>
                  {PUBLICATION_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-medium text-gray-700 mb-1">Сортировка</span>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Сортировка" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {SORT_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-medium text-gray-700 mb-1">Тип на вкладке «Все»</span>
          <Select
            value={typeQuick}
            onValueChange={(v) => setTypeQuick(v as "all" | "ARTICLE")}
            disabled={tab !== PublicationTabFilter.ALL}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Тип (см. табы)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              <SelectItem value="ARTICLE">Только статьи</SelectItem>
            </SelectContent>
          </Select>
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-medium text-gray-700 mb-1">Автор</span>
          <Select
            value={authorUserIdFilter || "__all_authors__"}
            onValueChange={(v) => setAuthorUserIdFilter(v === "__all_authors__" ? "" : v)}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Автор" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all_authors__">Все авторы</SelectItem>
              {authorOptions.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.email ? `${a.label} (${a.email})` : a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-medium text-gray-700 mb-1">Город</span>
          <Select
            value={cityId || "__all_cities__"}
            onValueChange={(v) => setCityId(v === "__all_cities__" ? "" : v)}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Город" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all_cities__">Все города</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
          <div className="min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="publications-updated-from">
              Обновлено не раньше
            </label>
          <Input
            id="publications-updated-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full min-w-0"
          />
          </div>
        </div>
        {tab !== PublicationTabFilter.ALL ? (
          <p className="text-xs text-muted-foreground">
            Быстрый фильтр «Только статьи» доступен на вкладке «Все».
          </p>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-500 border border-gray-200 rounded-lg bg-white">
          <p>Пока нет публикаций</p>
          <p className="text-sm text-gray-600 mt-2 max-w-sm mx-auto">{emptyListCreate.hint}</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-6"
            onClick={() => router.push(emptyListCreate.path)}
          >
            Создать публикацию
          </Button>
        </div>
      ) : (
        <div className="max-w-full min-w-0 overflow-hidden border border-gray-200 rounded-lg bg-white">
          <div className="min-w-0 max-w-full">
            <div className="relative min-w-0 max-w-full">
              {(tableScrollHint === "left" || tableScrollHint === "both") && (
                <div
                  className="pointer-events-none absolute left-0 top-0 z-30 h-full w-8 bg-gradient-to-r from-white to-transparent"
                  aria-hidden
                />
              )}
              {(tableScrollHint === "right" || tableScrollHint === "both") && (
                <div
                  className="pointer-events-none absolute right-0 top-0 z-30 h-full w-10 bg-gradient-to-l from-white to-transparent"
                  aria-hidden
                />
              )}
              <div className="max-w-full min-w-0">
                <div
                  ref={tableScrollRef}
                  className="max-w-full min-w-0 w-full overflow-x-auto overscroll-x-contain scroll-smooth pb-px [scrollbar-gutter:stable] [scrollbar-width:thin]"
                >
                  <div className="min-w-[900px]">
                    <table className="w-full table-auto text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-50 px-2 py-2 sm:px-3 sm:py-2.5 text-left font-medium text-gray-700 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] w-[min(200px,28vw)] sm:min-w-[180px] xl:w-auto">
                    Заголовок
                  </th>
                  <th className="px-2 py-2 sm:px-3 sm:py-2.5 text-left font-medium text-gray-700 w-[88px] xl:w-auto">
                    Тип
                  </th>
                  <th className="px-2 py-2 sm:px-3 sm:py-2.5 text-left font-medium text-gray-700 whitespace-nowrap w-[112px] xl:w-auto">
                    Статус
                  </th>
                  <th className="px-2 py-2 sm:px-3 sm:py-2.5 text-left font-medium text-gray-700 w-[120px] xl:max-w-[140px]">
                    Автор
                  </th>
                  <th className="px-2 py-2 sm:px-3 sm:py-2.5 text-left font-medium text-gray-700 w-[140px] xl:max-w-[180px]">
                    Город / контекст
                  </th>
                  <th className="px-2 py-2 sm:px-3 sm:py-2.5 text-left font-medium text-gray-700 whitespace-nowrap w-[104px] xl:w-auto">
                    Дата публикации
                  </th>
                  <th className="px-2 py-2 sm:px-3 sm:py-2.5 text-right font-medium text-gray-700 whitespace-nowrap w-[72px] xl:w-auto">
                    Просмотры
                  </th>
                  <th
                    className="sticky right-0 z-20 bg-gray-50 px-1.5 sm:px-3 py-2 sm:py-2.5 text-right font-medium text-gray-700 w-[48px] sm:w-[52px] shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]"
                    aria-label="Действия"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sorted.map((row) => {
                  const editHref = publicationEditHref(row);
                  const links = resolveArticleLikeLinks(row);
                  const viewHref =
                    row.status === PublicationStatus.PUBLISHED
                      ? links.publicUrl
                      : links.previewUrl;
                  return (
                  <tr key={row.id} className="hover:bg-gray-50/80 group">
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50/80 px-2 py-2 sm:px-3 sm:py-2.5 font-medium text-gray-900 max-w-[min(200px,40vw)] sm:max-w-[220px] truncate shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] align-top">
                      {editHref ? (
                        <Link
                          href={editHref}
                          className="text-primary hover:text-primary/90 hover:underline"
                        >
                          {row.title}
                        </Link>
                      ) : (
                        row.title
                      )}
                    </td>
                    <td className="px-2 py-2 sm:px-3 sm:py-2.5 text-gray-700 align-top">
                      {PUBLICATION_TYPE_LABEL[row.type]}
                    </td>
                    <td className="px-2 py-2 sm:px-3 sm:py-2.5 align-top">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-normal border text-[10px] sm:text-xs px-1.5 py-0 h-auto whitespace-normal leading-tight",
                          statusBadgeClass(row.status),
                        )}
                      >
                        {PUBLICATION_STATUS_LABEL[row.status]}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 sm:px-3 sm:py-2.5 text-gray-600 max-w-[140px] truncate align-top">
                      {row.authorLabel}
                    </td>
                    <td className="px-2 py-2 sm:px-3 sm:py-2.5 text-gray-600 max-w-[180px] truncate align-top">
                      {row.cityOrContext}
                    </td>
                    <td className="px-2 py-2 sm:px-3 sm:py-2.5 text-gray-600 whitespace-nowrap align-top">
                      {row.publishedAt
                        ? format(new Date(row.publishedAt), "d MMM yyyy", { locale: ru })
                        : "—"}
                    </td>
                    <td className="px-2 py-2 sm:px-3 sm:py-2.5 text-right tabular-nums text-gray-800 align-top">
                      {row.views.toLocaleString("ru-RU")}
                    </td>
                    <td className="sticky right-0 z-10 bg-white group-hover:bg-gray-50/80 px-1.5 sm:px-3 py-1.5 sm:py-2 text-right shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] align-top">
                      {hasArticleLikeActions(row) ? (
                        <div className="flex items-center justify-end gap-1">
                          {editHref ? (
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" asChild>
                              <Link href={editHref} aria-label="Редактировать" title="Редактировать">
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                          ) : null}
                          {viewHref ? (
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" asChild>
                              <Link
                                href={viewHref}
                                target="_blank"
                                aria-label={row.status === PublicationStatus.PUBLISHED ? "Открыть публичную страницу" : "Открыть предпросмотр"}
                                title={row.status === PublicationStatus.PUBLISHED ? "Открыть публичную страницу" : "Открыть предпросмотр"}
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          ) : null}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="Действия"
                                disabled={archivingId === row.id || deletingId === row.id}
                              >
                                {archivingId === row.id || deletingId === row.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem asChild>
                              <Link href={editHref!}>Редактировать</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={links.previewUrl ?? `/preview/articles/${row.id}`} target="_blank">
                                Открыть предпросмотр
                              </Link>
                            </DropdownMenuItem>
                            {row.status === PublicationStatus.PUBLISHED && links.publicUrl ? (
                              <DropdownMenuItem asChild>
                                <Link href={links.publicUrl} target="_blank">
                                  Открыть публикацию
                                </Link>
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => openStatsDrawer(row)}
                              className="gap-2"
                            >
                              <BarChart2 className="h-4 w-4 text-muted-foreground" />
                              Статистика
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={
                                archivingId === row.id || row.status === PublicationStatus.ARCHIVED
                              }
                              onClick={() => {
                                setArchiveTarget({
                                  id: row.id,
                                  title: row.title.trim() || "Без названия",
                                });
                              }}
                            >
                              {row.status === PublicationStatus.ARCHIVED
                                ? "Уже в архиве"
                                : "Архивировать"}
                            </DropdownMenuItem>
                            {row.status === PublicationStatus.DRAFT ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  disabled={deletingId === row.id}
                                  onClick={() =>
                                    setDeleteTarget({
                                      id: row.id,
                                      title: row.title.trim() || "Без названия",
                                      isDraft: true,
                                    })
                                  }
                                >
                                  Удалить черновик
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            {(tableScrollHint === "right" || tableScrollHint === "both") && (
              <div
                className="flex items-center justify-center gap-2 border-t border-amber-100 bg-amber-50/80 px-3 py-2 text-center text-xs text-amber-950"
                role="status"
              >
                <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                <span>Прокрутите таблицу вправо, чтобы увидеть «Просмотры» и меню действий</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
