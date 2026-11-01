"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Check,
  FolderOpen,
  Heart,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import { SaveToPlanModal } from "@/components/activity/SaveToPlanModal";
import { persistIdeaCollectionSelection } from "@/features/save/persistIdeaCollectionSelection";
import { requestPlanRefetchForDate } from "@/lib/my-plan/myPlanOpenIntent";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { IdeaItem } from "@/app/(public)/me/ideas/types";
import { sortIdeasPastLast } from "@/app/(public)/me/ideas/sortIdeas";
import {
  WITHOUT_COLLECTION,
  collectionTarget,
  updateCollectionCounts,
  visibleInCollection,
  type CollectionMemberships,
  type CollectionSummary,
} from "@/app/(public)/me/ideas/collectionState";
import {
  ideaKindLabel,
  ideaMetaLine,
  ideasWord,
  isPastIdea,
  sortCollections,
  toneForIdea,
  type CollectionSort,
} from "./ideaPresentation";
import styles from "./ideasCollections.module.css";

type Filter = "all" | "none" | string;
type View = "ideas" | "collections";

export type IdeasCollectionsHeader = {
  kicker: string;
  title: string;
  onBack: () => void;
};

type Props = {
  layout: "page" | "sheet";
  /** Без initialIdeas компонент сам загружает данные (экран в виджете плана). */
  initialIdeas?: IdeaItem[];
  initialCollections?: CollectionSummary[];
  initialMemberships?: CollectionMemberships;
  initialCollectionId?: string | null;
  discoveryHref?: string;
  /** sheet: шапку рисует хост (PlanScreenHeader), чтобы совпадал ритм с остальными экранами плана. */
  renderHeader?: (header: IdeasCollectionsHeader) => ReactNode;
  /** sheet: «назад» из корневого экрана идей. */
  onBack?: () => void;
  /** sheet: закрыть виджет перед переходом на страницу идеи. */
  onNavigate?: () => void;
  onIdeasCountChange?: (count: number) => void;
};

const KIND_ICON = { Статья: BookOpen, Место: MapPin, Событие: Ticket } as const;

function IdeaPoster({ idea }: { idea: IdeaItem }) {
  const Icon = KIND_ICON[ideaKindLabel(idea) as keyof typeof KIND_ICON] ?? Sparkles;
  const cover = idea.activity.coverImageUrl;
  return (
    <span className={styles.p} style={{ background: toneForIdea(idea.id) }}>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" loading="lazy" decoding="async" />
      ) : (
        <Icon size={20} strokeWidth={1.8} aria-hidden />
      )}
    </span>
  );
}

function Mosaic({ items }: { items: IdeaItem[] }) {
  const pics = items.slice(0, 4);
  return (
    <span className={cn(styles.ctm, pics.length > 0 && styles[`n${pics.length}` as "n1"])}>
      {pics.length > 0 ? (
        pics.map((idea) => <IdeaPoster key={idea.id} idea={idea} />)
      ) : (
        <FolderOpen size={22} strokeWidth={1.8} aria-hidden />
      )}
    </span>
  );
}

function ideaEntityKey(idea: IdeaItem): string {
  return `${idea.ideaType}:${idea.activity.id}`;
}

function mergeIdeas(current: IdeaItem[], incoming: IdeaItem[]): IdeaItem[] {
  const byEntity = new Map<string, IdeaItem>();
  for (const idea of [...current, ...incoming]) byEntity.set(ideaEntityKey(idea), idea);
  return sortIdeasPastLast([...byEntity.values()]);
}

function buildRemoveQuery(idea: IdeaItem): string {
  if (idea.ideaType === "OFFER") return `offerId=${idea.activity.id}`;
  if (idea.ideaType === "ROUTE") return `routeId=${idea.activity.id}`;
  if (idea.ideaType === "ARTICLE") return `articleId=${idea.activity.id}`;
  return `activityId=${idea.activity.id}`;
}

export function IdeasCollections({
  layout,
  initialIdeas,
  initialCollections = [],
  initialMemberships = {},
  initialCollectionId = null,
  discoveryHref = "/minsk",
  renderHeader,
  onBack,
  onNavigate,
  onIdeasCountChange,
}: Props) {
  const router = useRouter();
  const [ideas, setIdeas] = useState<IdeaItem[]>(initialIdeas ?? []);
  const [collections, setCollections] = useState<CollectionSummary[]>(initialCollections);
  const [memberships, setMemberships] = useState<CollectionMemberships>(initialMemberships);
  const [loaded, setLoaded] = useState(initialIdeas !== undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>(initialCollectionId ?? "all");
  const [view, setView] = useState<View>("ideas");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [collMenu, setCollMenu] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  /** Идея, для которой создаём коллекцию из меню «⋯» — после создания кладём её внутрь. */
  const [createForIdea, setCreateForIdea] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [planModalId, setPlanModalId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Идеи (кроме статей) приходят с сервера страницы или из /api/me/ideas; статьи догружаем отдельно, как раньше.
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      if (initialIdeas === undefined) {
        try {
          const response = await fetch("/api/me/ideas", { cache: "no-store", signal: controller.signal });
          if (!response.ok) throw new Error("load_failed");
          const data = (await response.json()) as {
            ideas?: IdeaItem[];
            collections?: CollectionSummary[];
            memberships?: CollectionMemberships;
          };
          setIdeas(data.ideas ?? []);
          setCollections(data.collections ?? []);
          setMemberships(data.memberships ?? {});
          setLoaded(true);
        } catch (error) {
          if ((error as Error).name === "AbortError") return;
          setLoadFailed(true);
          setLoaded(true);
          return;
        }
      }
      // Статьи — необязательная догрузка: её сбой не должен прятать уже загруженные идеи.
      try {
        const articles = await fetch("/api/ideas/articles", { signal: controller.signal });
        if (!articles.ok) return;
        const data = (await articles.json()) as { items?: IdeaItem[] };
        if (Array.isArray(data.items) && data.items.length > 0) {
          setIdeas((current) => mergeIdeas(current, data.items ?? []));
        }
      } catch {
        // оставляем основной список как есть
      }
    }
    void load();
    return () => controller.abort();
  }, [initialIdeas]);

  useEffect(() => {
    if (loaded) onIdeasCountChange?.(ideas.length);
  }, [ideas.length, loaded, onIdeasCountChange]);

  // Закрытие меню кликом вне и по Esc.
  useEffect(() => {
    if (!menuId && !collMenu) return;
    const close = () => {
      setMenuId(null);
      setCollMenu(false);
    };
    const onDown = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest("[data-ic-menu]")) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuId, collMenu]);

  const currentCollection = collections.find((item) => item.id === filter) ?? null;
  // Выбранной коллекции больше нет (удалена/не найдена) — показываем все идеи.
  const activeFilter: Filter = filter === "all" || filter === "none" || currentCollection ? filter : "all";

  const withoutCount = useMemo(
    () => ideas.filter((idea) => visibleInCollection(idea, WITHOUT_COLLECTION, memberships)).length,
    [ideas, memberships],
  );
  const itemsByCollection = useMemo(() => {
    const map = new Map<string, IdeaItem[]>();
    for (const idea of ideas) {
      for (const id of memberships[idea.id] ?? []) {
        const list = map.get(id) ?? [];
        list.push(idea);
        map.set(id, list);
      }
    }
    return map;
  }, [ideas, memberships]);
  const visible = useMemo(
    () =>
      activeFilter === "all"
        ? ideas
        : ideas.filter((idea) => visibleInCollection(idea, activeFilter === "none" ? WITHOUT_COLLECTION : activeFilter, memberships)),
    [activeFilter, ideas, memberships],
  );

  const refreshCollections = useCallback(async () => {
    try {
      const response = await fetch("/api/collections", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { collections?: CollectionSummary[] };
      if (Array.isArray(data.collections)) setCollections(data.collections);
    } catch {
      // Оставляем оптимистичные счётчики — обновятся при следующем действии.
    }
  }, []);

  async function putMembership(idea: IdeaItem, ids: string[]): Promise<boolean> {
    try {
      const response = await fetch("/api/save/idea/collections", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...collectionTarget(idea), collectionIds: ids }),
      });
      if (!response.ok) throw new Error("membership_failed");
      const unique = [...new Set(ids)];
      const previous = memberships[idea.id] ?? [];
      setMemberships((current) => ({ ...current, [idea.id]: unique }));
      setCollections((current) => updateCollectionCounts(current, previous, unique));
      void refreshCollections();
      return true;
    } catch {
      toast.error("Не удалось сохранить коллекции", { description: "Повторите попытку — идея не удалена" });
      return false;
    }
  }

  async function createCollection(title: string): Promise<CollectionSummary | null> {
    try {
      const response = await fetch("/api/collections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string };
        toast.error(
          json.error === "COLLECTION_EXISTS"
            ? "Такая коллекция уже есть"
            : json.error === "COLLECTION_LIMIT"
              ? "Можно создать не больше 50 коллекций"
              : "Не удалось создать коллекцию",
        );
        return null;
      }
      const result = (await response.json()) as { collection: { id: string; title: string } };
      const collection = { ...result.collection, count: 0 };
      setCollections((current) => [...current, collection]);
      void refreshCollections();
      return collection;
    } catch {
      toast.error("Не удалось создать коллекцию");
      return null;
    }
  }

  async function submitCreate() {
    const title = newTitle.trim();
    if (!title) return;
    const collection = await createCollection(title);
    if (!collection) return;
    const idea = createForIdea ? ideas.find((item) => item.id === createForIdea) : null;
    if (idea) await putMembership(idea, [...(memberships[idea.id] ?? []), collection.id]);
    setCreating(false);
    setNewTitle("");
    setCreateForIdea(null);
    setFilter(collection.id);
    setView("ideas");
    toast.success("Коллекция создана");
  }

  function cancelCreate() {
    setCreating(false);
    setNewTitle("");
    setCreateForIdea(null);
  }

  async function submitRename() {
    const title = (renaming ?? "").trim();
    const id = currentCollection?.id;
    setRenaming(null);
    if (!title || !id || title === currentCollection?.title) return;
    try {
      const response = await fetch(`/api/collections/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string };
        toast.error(json.error === "COLLECTION_EXISTS" ? "Такая коллекция уже есть" : "Не удалось переименовать");
        return;
      }
      setCollections((current) => current.map((item) => (item.id === id ? { ...item, title } : item)));
      toast.success("Коллекция переименована");
    } catch {
      toast.error("Не удалось переименовать");
    }
  }

  async function deleteCurrentCollection() {
    const id = currentCollection?.id;
    setCollMenu(false);
    if (!id) return;
    try {
      const response = await fetch(`/api/collections/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete_failed");
      setCollections((current) => current.filter((item) => item.id !== id));
      setMemberships((current) =>
        Object.fromEntries(Object.entries(current).map(([ideaId, ids]) => [ideaId, ids.filter((item) => item !== id)])),
      );
      setFilter("all");
      toast.success("Коллекция удалена. Идеи сохранены.");
    } catch {
      toast.error("Не удалось удалить коллекцию");
    }
  }

  async function toggleInCollection(idea: IdeaItem, collectionId: string) {
    const current = memberships[idea.id] ?? [];
    const next = current.includes(collectionId) ? current.filter((id) => id !== collectionId) : [...current, collectionId];
    setMenuId(null);
    if (await putMembership(idea, next)) {
      toast.success(next.includes(collectionId) ? "Добавлено в коллекцию" : "Убрано из коллекции");
    }
  }

  async function removeFromCurrentCollection(idea: IdeaItem) {
    if (!currentCollection) return;
    setMenuId(null);
    if (await putMembership(idea, (memberships[idea.id] ?? []).filter((id) => id !== currentCollection.id))) {
      toast.success("Убрано из коллекции");
    }
  }

  async function removeIdea(idea: IdeaItem, silent = false) {
    const previous = ideas;
    setMenuId(null);
    setRemovingId(idea.id);
    setIdeas((current) => current.filter((item) => item.id !== idea.id));
    try {
      const response = await fetch(`/api/save/idea?${buildRemoveQuery(idea)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("remove_failed");
      setMemberships((current) => {
        const next = { ...current };
        delete next[idea.id];
        return next;
      });
      void refreshCollections();
      if (!silent) toast.success("Удалено из идей");
    } catch {
      setIdeas(previous);
      toast.error("Не удалось удалить из идей", { description: "Попробуйте ещё раз" });
    } finally {
      setRemovingId((current) => (current === idea.id ? null : current));
    }
  }

  async function persistPlanChange(
    idea: IdeaItem,
    result: { action: "plan"; dateISO: string; visibility?: "PRIVATE" | "FAMILY" } | { action: "remove-plan"; planItemId: string },
  ) {
    try {
      const response =
        result.action === "plan"
          ? await fetch("/api/save/plan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...(idea.ideaType === "ROUTE" ? { routeId: idea.activity.id } : { activityId: idea.activity.id }),
                date: result.dateISO,
                title: idea.activity.title,
                coverImageUrl: idea.activity.coverImageUrl,
                ...(result.visibility ? { visibility: result.visibility } : {}),
              }),
            })
          : await fetch(`/api/save/plan?planItemId=${encodeURIComponent(result.planItemId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("plan_change_failed");
      setIdeas((current) =>
        current.map((item) =>
          item.id !== idea.id
            ? item
            : result.action === "plan"
              ? { ...item, isPlanned: true, plannedDate: result.dateISO, planStatus: "PLANNED_UPCOMING" }
              : { ...item, isPlanned: false, plannedDate: undefined, planItemId: undefined, planStatus: "UNPLANNED" },
        ),
      );
      // Стор виджета плана живёт на клиенте — просим перезагрузить затронутые даты.
      for (const date of new Set([idea.plannedDate, result.action === "plan" ? result.dateISO : undefined])) {
        if (date) requestPlanRefetchForDate(date);
      }
      router.refresh();
    } catch {
      toast.error("Не удалось изменить план", { description: "Попробуйте ещё раз" });
    }
  }

  const planningIdea = ideas.find((idea) => idea.id === planModalId) ?? null;

  function pickFilter(next: Filter) {
    setFilter(next);
    setRenaming(null);
    setCollMenu(false);
  }

  function openIdea(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (!onNavigate) return;
    event.preventDefault();
    onNavigate();
    window.setTimeout(() => router.push(href), 0);
  }

  /* ——— разметка ——— */

  const createTile = creating && !createForIdea ? (
    <div className={cn(styles.ct, styles.mk)}>
      <span className={cn(styles.ctm)}>
        <FolderOpen size={22} strokeWidth={1.8} aria-hidden />
        <input
          autoFocus
          value={newTitle}
          maxLength={60}
          onChange={(event) => setNewTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submitCreate();
            if (event.key === "Escape") cancelCreate();
          }}
          placeholder="Название"
          aria-label="Название коллекции"
        />
      </span>
      <span className={styles.mka}>
        <button type="button" className={cn(styles.go, styles.sm)} disabled={!newTitle.trim()} onClick={() => void submitCreate()}>
          Создать
        </button>
        <button type="button" className={styles.mb} onClick={cancelCreate} aria-label="Отмена">
          <X size={16} strokeWidth={2} aria-hidden />
        </button>
      </span>
    </div>
  ) : (
    <button
      type="button"
      className={cn(styles.ct, styles.new)}
      onClick={() => {
        setCreateForIdea(null);
        setCreating(true);
      }}
    >
      <span className={styles.ctm}>
        <Plus size={24} strokeWidth={2} aria-hidden />
      </span>
      <b>Новая коллекция</b>
      <span className={styles.mono}>собрать идеи</span>
    </button>
  );

  const ideaCard = (idea: IdeaItem) => {
    const past = isPastIdea(idea);
    const href = idea.activity.publicHref ?? null;
    const meta = ideaMetaLine(idea);
    const ideaCollections = memberships[idea.id] ?? [];
    const firstCollection = collections.find((item) => ideaCollections.includes(item.id));
    const kicker = [ideaKindLabel(idea), activeFilter === "all" || activeFilter === "none" ? firstCollection?.title : null]
      .filter(Boolean)
      .join(" · ");
    const posterBlock = (
      <span className={styles.pw}>
        {href && !past ? (
          <Link href={href} onClick={(event) => openIdea(event, href)} aria-label={idea.activity.title} tabIndex={-1}>
            <IdeaPoster idea={idea} />
          </Link>
        ) : (
          <IdeaPoster idea={idea} />
        )}
        <button type="button" className={styles.hb} aria-label="Убрать из идей" disabled={removingId === idea.id} onClick={() => void removeIdea(idea)}>
          <Heart size={15} fill="currentColor" strokeWidth={1.8} aria-hidden />
        </button>
      </span>
    );
    return (
      <div key={idea.id} className={cn(styles.it, menuId === idea.id && styles.mo, past && styles.past)}>
        {posterBlock}
        <span className={styles.b}>
          <span className={styles.k}>{kicker}</span>
          {href && !past ? (
            <Link href={href} className={styles.t} onClick={(event) => openIdea(event, href)}>
              {idea.activity.title}
            </Link>
          ) : (
            <span className={styles.t}>{idea.activity.title}</span>
          )}
          {meta ? <span className={styles.pl}>{meta}</span> : null}
          {idea.isPlanned ? <span className={styles.badge}>В плане</span> : null}
          {past ? <span className={styles.badge}>Уже прошло</span> : null}
          <span className={styles.a}>
            {past ? null : (
              <button type="button" className={styles.go} onClick={() => setPlanModalId(idea.id)}>
                {idea.isPlanned ? "Изменить" : "В план"}
              </button>
            )}
            <button
              type="button"
              data-ic-menu
              className={styles.mb}
              aria-label="Ещё"
              aria-expanded={menuId === idea.id}
              onClick={() => setMenuId(menuId === idea.id ? null : idea.id)}
            >
              <MoreHorizontal size={18} strokeWidth={2.4} aria-hidden />
            </button>
          </span>
        </span>
        {menuId === idea.id ? (
          <div className={styles.menu} role="menu" data-ic-menu>
            <span className={styles.mh}>В коллекцию</span>
            {collections.map((item) => (
              <button key={item.id} type="button" role="menuitemcheckbox" aria-checked={ideaCollections.includes(item.id)} onClick={() => void toggleInCollection(idea, item.id)}>
                <span className={styles.ck}>{ideaCollections.includes(item.id) ? <Check size={14} strokeWidth={2.6} aria-hidden /> : null}</span>
                {item.title}
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuId(null);
                setCreateForIdea(idea.id);
                setCreating(true);
              }}
            >
              <span className={styles.ck}>
                <Plus size={14} strokeWidth={2.2} aria-hidden />
              </span>
              Новая коллекция
            </button>
            {currentCollection && ideaCollections.includes(currentCollection.id) ? (
              <button type="button" role="menuitem" onClick={() => void removeFromCurrentCollection(idea)}>
                <span className={styles.ck} />
                Убрать из коллекции
              </button>
            ) : null}
            <i className={styles.sep} />
            <button type="button" role="menuitem" className={styles.red} onClick={() => void removeIdea(idea)}>
              <span className={styles.ck} />
              Удалить из идей
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  const collectionBar = currentCollection ? (
    <div className={styles.cbar}>
      {renaming !== null ? (
        <>
          <input
            autoFocus
            value={renaming}
            maxLength={60}
            onChange={(event) => setRenaming(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submitRename();
              if (event.key === "Escape") setRenaming(null);
            }}
            aria-label="Новое название"
          />
          <button type="button" className={cn(styles.go, styles.sm)} onClick={() => void submitRename()}>
            Готово
          </button>
        </>
      ) : (
        <>
          <span className={styles.cbt}>
            <b>{currentCollection.title}</b>
            <span className={styles.mono}>Личная · {ideasWord(visible.length)}</span>
          </span>
          <button
            type="button"
            data-ic-menu
            className={styles.mb}
            aria-label="Действия с коллекцией"
            aria-expanded={collMenu}
            onClick={() => setCollMenu(!collMenu)}
          >
            <MoreHorizontal size={18} strokeWidth={2.4} aria-hidden />
          </button>
          {collMenu ? (
            <div className={cn(styles.menu, styles.menuCm)} role="menu" data-ic-menu>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setRenaming(currentCollection.title);
                  setCollMenu(false);
                }}
              >
                <span className={styles.ck} />
                Переименовать
              </button>
              <button type="button" role="menuitem" className={styles.red} onClick={() => void deleteCurrentCollection()}>
                <span className={styles.ck} />
                Удалить коллекцию
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  ) : null;

  const emptyState = (
    <div className={styles.empty}>
      <b>
        {currentCollection ? "В коллекции пусто" : activeFilter === "none" ? "Все идеи разложены" : "Идей пока нет"}
      </b>
      <span>
        {currentCollection
          ? "Нажмите «⋯» на любой идее и выберите эту коллекцию"
          : activeFilter === "none"
            ? "Каждая сохранённая идея уже лежит в какой-нибудь коллекции"
            : "Нажимайте ♡ на событиях, местах и статьях — они появятся здесь"}
      </span>
      {activeFilter === "all" ? (
        <Link href={discoveryHref} onClick={(event) => openIdea(event, discoveryHref)}>
          Найти, что сохранить →
        </Link>
      ) : null}
    </div>
  );

  const ideasPanel = !loaded ? (
    <p className={styles.loading}>Загружаем идеи…</p>
  ) : (
    <div>
      <div className={styles.sh}>
        <b>Коллекции</b>
        <button type="button" className={styles.all} onClick={() => setView("collections")}>
          {`Все ${collections.length} →`}
        </button>
      </div>
      <div className={styles.crow}>
        {collections.map((item) => {
          const items = itemsByCollection.get(item.id) ?? [];
          const count = Math.max(item.count, items.length);
          return (
            <button
              key={item.id}
              type="button"
              className={cn(styles.ct, activeFilter === item.id && styles.on)}
              aria-pressed={activeFilter === item.id}
              onClick={() => pickFilter(activeFilter === item.id ? "all" : item.id)}
            >
              <Mosaic items={items} />
              <b>{item.title}</b>
              <span className={styles.mono}>{count ? ideasWord(count) : "пусто"}</span>
            </button>
          );
        })}
        {createTile}
      </div>
      {creating && createForIdea ? (
        <div className={cn(styles.cbar)} style={{ marginTop: 14 }}>
          <input
            autoFocus
            value={newTitle}
            maxLength={60}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submitCreate();
              if (event.key === "Escape") cancelCreate();
            }}
            placeholder="Название новой коллекции"
            aria-label="Название коллекции"
          />
          <button type="button" className={cn(styles.go, styles.sm)} disabled={!newTitle.trim()} onClick={() => void submitCreate()}>
            Создать
          </button>
          <button type="button" className={styles.mb} onClick={cancelCreate} aria-label="Отмена">
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
      ) : null}
      <div className={styles.chips}>
        <button type="button" className={cn(styles.chip, activeFilter === "all" && styles.on)} aria-pressed={activeFilter === "all"} onClick={() => pickFilter("all")}>
          {`Все · ${ideas.length}`}
        </button>
        <button type="button" className={cn(styles.chip, activeFilter === "none" && styles.on)} aria-pressed={activeFilter === "none"} onClick={() => pickFilter("none")}>
          {`Без коллекции · ${withoutCount}`}
        </button>
        {currentCollection ? (
          <button type="button" className={cn(styles.chip, styles.on)} aria-pressed onClick={() => pickFilter("all")}>
            {`${currentCollection.title} · ${visible.length}`}
          </button>
        ) : null}
      </div>
      {collectionBar}
      {loadFailed ? (
        <div className={styles.empty}>
          <b>Не удалось загрузить идеи</b>
          <span>Проверьте соединение и откройте экран ещё раз</span>
        </div>
      ) : visible.length === 0 ? (
        emptyState
      ) : (
        <div className={styles.list}>{visible.map(ideaCard)}</div>
      )}
    </div>
  );

  const collectionsPanel = (
    <CollectionsPanel
      collections={collections}
      itemsByCollection={itemsByCollection}
      currentId={activeFilter}
      onOpen={(id) => {
        pickFilter(id);
        setView("ideas");
      }}
      onCreate={createCollection}
      onCreated={(id) => {
        pickFilter(id);
        setView("ideas");
        toast.success("Коллекция создана");
      }}
    />
  );

  return (
    <div className={styles.root} data-layout={layout}>
      {layout === "page" ? (
        <>
          <div className={styles.top}>
            <nav className={styles.crumbs} aria-label="Навигация">
              <Link href="/me">← Профиль</Link>
              <span aria-hidden>→</span>
              <b>Мои идеи</b>
            </nav>
            <Link href="/me/plan" className={styles.planLink}>
              Мой план →
            </Link>
          </div>
          <div className={styles.kick}>
            <i />
            Мои идеи
          </div>
          <h1 className={styles.h1}>Мои идеи и коллекции</h1>
          <p className={styles.lead}>
            Сохраняйте понравившиеся активности, собирайте их в коллекции и переносите в план, когда удобно.
          </p>
          {ideasPanel}
          {view === "collections" ? (
            <CollectionsDrawer
              onClose={() => setView("ideas")}
              body={collectionsPanel}
            />
          ) : null}
        </>
      ) : (
        <>
          {renderHeader?.(
            view === "collections"
              ? { kicker: "Мои идеи", title: "Коллекции", onBack: () => setView("ideas") }
              : { kicker: "Мои идеи", title: loaded ? ideasWord(ideas.length) : "Мои идеи", onBack: onBack ?? (() => undefined) },
          )}
          <div className={styles.sheetBody}>{view === "collections" ? collectionsPanel : ideasPanel}</div>
        </>
      )}

      <SaveToPlanModal
        open={planModalId !== null}
        onOpenChange={(open) => {
          if (!open) setPlanModalId(null);
        }}
        scenario={{
          kind: "quickdate",
          title: planningIdea?.activity.title ?? "",
          eventPlanDateISO: planningIdea?.activity.dateStart ?? undefined,
          eventPlanDateEndISO: planningIdea?.activity.dateEnd ?? undefined,
          ticket: planningIdea
            ? {
                title: planningIdea.activity.title,
                imageUrl: planningIdea.activity.coverImageUrl,
                venue: planningIdea.activity.placeTitle,
                address: planningIdea.activity.addressLabel,
                priceMode: planningIdea.activity.priceFrom === 0 ? "FREE" : planningIdea.activity.priceFrom != null ? "FROM" : "UNKNOWN",
                priceValue: planningIdea.activity.priceFrom,
              }
            : undefined,
          ideaOnly: planningIdea?.ideaType === "ARTICLE" || planningIdea?.ideaType === "OFFER",
        }}
        isIdea={true}
        inPlan={planningIdea?.isPlanned ?? false}
        planDate={planningIdea?.plannedDate ?? null}
        planItemId={planningIdea?.planItemId ?? null}
        source="ideas"
        collectionTarget={planningIdea ? collectionTarget(planningIdea) : undefined}
        onConfirm={(result) => {
          if ((result.action === "plan" || result.action === "remove-plan") && planningIdea) {
            void persistPlanChange(planningIdea, result);
          } else if (result.action === "remove-idea" && planningIdea) {
            void removeIdea(planningIdea, true);
          } else if (result.action === "ideas" && planningIdea) {
            const idea = planningIdea;
            const target = collectionTarget(idea);
            void persistIdeaCollectionSelection(result, target)
              .then(async () => {
                const response = await fetch("/api/save/idea/collections?" + new URLSearchParams(target), { cache: "no-store" });
                if (response.ok) {
                  const json = (await response.json()) as { collectionIds?: string[] };
                  if (Array.isArray(json.collectionIds)) {
                    setMemberships((current) => ({ ...current, [idea.id]: json.collectionIds ?? [] }));
                  }
                }
                await refreshCollections();
              })
              .catch(() => toast.error("Не удалось обновить коллекцию"));
          }
          setPlanModalId(null);
        }}
      />
    </div>
  );
}

/* ——— экран «Мои коллекции» ——— */

function CollectionsPanel({
  collections,
  itemsByCollection,
  currentId,
  onOpen,
  onCreate,
  onCreated,
}: {
  collections: CollectionSummary[];
  itemsByCollection: Map<string, IdeaItem[]>;
  currentId: string;
  onOpen: (id: string) => void;
  onCreate: (title: string) => Promise<CollectionSummary | null>;
  onCreated: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CollectionSort>("new");
  const [making, setMaking] = useState(false);
  const [title, setTitle] = useState("");

  const needle = query.trim().toLowerCase();
  const rows = collections.map((collection, index) => {
    const items = itemsByCollection.get(collection.id) ?? [];
    return { ...collection, index, items, count: Math.max(collection.count, items.length) };
  });
  const filtered = sortCollections(
    rows.filter(
      (row) => !needle || row.title.toLowerCase().includes(needle) || row.items.some((idea) => idea.activity.title.toLowerCase().includes(needle)),
    ),
    sort,
  );

  async function create() {
    const name = title.trim();
    if (!name) return;
    const collection = await onCreate(name);
    if (collection) onCreated(collection.id);
  }

  return (
    <div className={styles.colls}>
      <label className={styles.srch}>
        <Search size={18} strokeWidth={1.8} aria-hidden />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти коллекцию или идею" aria-label="Поиск" />
        {query ? (
          <button type="button" onClick={() => setQuery("")} aria-label="Очистить">
            <X size={14} strokeWidth={2.2} aria-hidden />
          </button>
        ) : null}
      </label>
      <div className={styles.sort} role="radiogroup" aria-label="Сортировка">
        <span className={styles.mono}>сортировка</span>
        {(
          [
            ["new", "Новые"],
            ["az", "А–Я"],
            ["big", "Больше идей"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="radio" aria-checked={sort === key} className={sort === key ? styles.on : ""} onClick={() => setSort(key)}>
            {label}
          </button>
        ))}
      </div>
      {making ? (
        <div className={cn(styles.cr, styles.mk)}>
          <span className={styles.ctm}>
            <FolderOpen size={22} strokeWidth={1.8} aria-hidden />
          </span>
          <input
            autoFocus
            value={title}
            maxLength={60}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void create();
              if (event.key === "Escape") {
                setMaking(false);
                setTitle("");
              }
            }}
            placeholder="Название коллекции"
            aria-label="Название коллекции"
          />
          <button type="button" className={cn(styles.go, styles.sm)} disabled={!title.trim()} onClick={() => void create()}>
            Создать
          </button>
        </div>
      ) : (
        <button type="button" className={cn(styles.cr, styles.new)} onClick={() => setMaking(true)}>
          <span className={styles.ctm}>
            <Plus size={22} strokeWidth={2} aria-hidden />
          </span>
          <span className={styles.crb}>
            <b>Новая коллекция</b>
            <span className={styles.mono}>собрать идеи в подборку</span>
          </span>
        </button>
      )}
      <div className={styles.crl}>
        {filtered.map((row) => {
          const hit = needle && !row.title.toLowerCase().includes(needle) ? row.items.find((idea) => idea.activity.title.toLowerCase().includes(needle)) : null;
          return (
            <button key={row.id} type="button" className={cn(styles.cr, currentId === row.id && styles.on)} onClick={() => onOpen(row.id)}>
              <Mosaic items={row.items} />
              <span className={styles.crb}>
                <b>{row.title}</b>
                <span className={styles.mono}>{`Личная · ${row.count ? ideasWord(row.count) : "пусто"}`}</span>
                {hit ? <span className={styles.hit}>{`нашли: ${hit.activity.title}`}</span> : null}
              </span>
              <ArrowRight size={18} strokeWidth={1.8} aria-hidden />
            </button>
          );
        })}
      </div>
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <b>Ничего не нашли</b>
          <span>{needle ? "Попробуйте другое слово или сбросьте поиск" : "Здесь пока пусто"}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Правая панель страницы: scrim + карточка 500px, закрытие по крестику, клику по scrim и Esc. */
function CollectionsDrawer({ body, onClose }: { body: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className={styles.scrim}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className={styles.drawer} role="dialog" aria-label="Мои коллекции">
        <div className={styles.dhd}>
          <div>
            <div className={styles.kick}>
              <i />
              Мои идеи
            </div>
            <b>Мои коллекции</b>
          </div>
          <button type="button" className={styles.x} onClick={onClose} aria-label="Закрыть">
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className={styles.dbd}>{body}</div>
      </aside>
    </div>
  );
}
