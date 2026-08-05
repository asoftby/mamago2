/**
 * Чистая state-machine для непрерывного чтения статей в разделе.
 * Без DOM / React — покрывается node:assert тестами.
 */

export type ContinuousLoadStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "exhausted";

export type ContinuousArticleRef = {
  id: string;
  slug: string;
  href: string;
  documentTitle: string;
};

export type ContinuousReaderState = {
  articles: ContinuousArticleRef[];
  activeIndex: number;
  loadStatus: ContinuousLoadStatus;
  /** Поколение запроса — игнорировать устаревшие ответы */
  requestGeneration: number;
  errorMessage: string | null;
  exhaustedAnnounced: boolean;
};

export type ContinuousReaderEvent =
  | { type: "PREFETCH_NEAR_END" }
  | { type: "LOAD_STARTED"; generation: number }
  | {
      type: "LOAD_SUCCESS";
      generation: number;
      article: ContinuousArticleRef;
    }
  | { type: "LOAD_EMPTY"; generation: number }
  | { type: "LOAD_ERROR"; generation: number; message: string }
  | { type: "RETRY" }
  | { type: "SET_ACTIVE_INDEX"; index: number; stableMs: number }
  | { type: "RESET_ACTIVE_CANDIDATE" };

export function createContinuousReaderState(
  initial: ContinuousArticleRef,
): ContinuousReaderState {
  return {
    articles: [initial],
    activeIndex: 0,
    loadStatus: "idle",
    requestGeneration: 0,
    errorMessage: null,
    exhaustedAnnounced: false,
  };
}

export function shouldPrefetchNext(state: ContinuousReaderState): boolean {
  if (state.loadStatus === "loading" || state.loadStatus === "exhausted") {
    return false;
  }
  if (state.loadStatus === "error") return false;
  // В DOM заранее максимум одна следующая статья
  return state.articles.length === state.activeIndex + 1;
}

export function excludeIdsFromState(state: ContinuousReaderState): string[] {
  return state.articles.map((a) => a.id);
}

/**
 * Активация статьи: индекс меняется только если кандидат стабилен.
 * `pendingIndex` + таймер живут снаружи; здесь — чистая проверка.
 */
export function resolveActiveIndexAfterStable(
  state: ContinuousReaderState,
  candidateIndex: number,
): number {
  if (
    candidateIndex < 0 ||
    candidateIndex >= state.articles.length ||
    candidateIndex === state.activeIndex
  ) {
    return state.activeIndex;
  }
  return candidateIndex;
}

export function reduceContinuousReader(
  state: ContinuousReaderState,
  event: ContinuousReaderEvent,
): ContinuousReaderState {
  switch (event.type) {
    case "PREFETCH_NEAR_END": {
      if (!shouldPrefetchNext(state)) return state;
      return {
        ...state,
        loadStatus: "loading",
        errorMessage: null,
        requestGeneration: state.requestGeneration + 1,
      };
    }
    case "LOAD_STARTED": {
      if (event.generation !== state.requestGeneration) return state;
      return { ...state, loadStatus: "loading", errorMessage: null };
    }
    case "LOAD_SUCCESS": {
      if (event.generation !== state.requestGeneration) return state;
      if (state.articles.some((a) => a.id === event.article.id)) {
        return { ...state, loadStatus: "ready", errorMessage: null };
      }
      return {
        ...state,
        articles: [...state.articles, event.article],
        loadStatus: "ready",
        errorMessage: null,
      };
    }
    case "LOAD_EMPTY": {
      if (event.generation !== state.requestGeneration) return state;
      return {
        ...state,
        loadStatus: "exhausted",
        errorMessage: null,
        exhaustedAnnounced: true,
      };
    }
    case "LOAD_ERROR": {
      if (event.generation !== state.requestGeneration) return state;
      return {
        ...state,
        loadStatus: "error",
        errorMessage: event.message,
      };
    }
    case "RETRY": {
      if (state.loadStatus !== "error") return state;
      return {
        ...state,
        loadStatus: "idle",
        errorMessage: null,
      };
    }
    case "SET_ACTIVE_INDEX": {
      const next = resolveActiveIndexAfterStable(state, event.index);
      if (next === state.activeIndex) return state;
      return { ...state, activeIndex: next };
    }
    case "RESET_ACTIVE_CANDIDATE":
      return state;
    default:
      return state;
  }
}

/** Progress buckets per article — дедуп по Set ключей. */
export type ArticleProgressBucket = 25 | 50 | 75 | 100;

export function progressBucketsCrossed(
  prevRatio: number,
  nextRatio: number,
): ArticleProgressBucket[] {
  const buckets: ArticleProgressBucket[] = [25, 50, 75, 100];
  const out: ArticleProgressBucket[] = [];
  for (const b of buckets) {
    const t = b / 100;
    if (prevRatio < t && nextRatio >= t) out.push(b);
  }
  return out;
}

export type ArticleAnalyticsKind =
  | "article_impression"
  | "article_view"
  | "article_read_25"
  | "article_read_50"
  | "article_read_75"
  | "article_complete"
  | "next_article_loaded"
  | "next_article_started"
  | "article_section_exhausted";

export function analyticsEventKey(
  kind: ArticleAnalyticsKind,
  articleId: string,
): string {
  return `${kind}:${articleId}`;
}

/**
 * Условие «основная статья в viewport»:
 * верх заголовка пересёк контрольную линию (примерно 28% высоты viewport сверху).
 */
export function pickActiveArticleIndex(args: {
  headerTops: number[];
  viewportHeight: number;
  /** Доля высоты viewport для контрольной линии сверху */
  activationLineRatio?: number;
}): number {
  const line =
    (args.activationLineRatio ?? 0.28) * Math.max(1, args.viewportHeight);
  let active = 0;
  for (let i = 0; i < args.headerTops.length; i++) {
    if (args.headerTops[i] <= line) active = i;
  }
  return active;
}
