import {
  buildAttachmentsQuery,
  buildPlaceIndexQuery,
  buildPostMetaQuery,
  buildPublishedArticleByIdQuery,
  buildPublishedArticlesQuery,
  buildPublishedEventByIdQuery,
  buildPublishedEventsQuery,
  buildPublishedPlacesQuery,
  buildPublishedRouteByIdQuery,
  buildPublishedRoutesQuery,
  buildRankMathRedirectsQuery,
  buildTermsQuery,
  buildUsersQuery,
  clampLimit,
} from "./sql";
import type {
  WordPressArticleBundle,
  WordPressAttachmentRow,
  WordPressEventBundle,
  WordPressPlaceBundle,
  WordPressPlaceIndexRow,
  WordPressPostMetaByKey,
  WordPressPostMetaRow,
  WordPressPostRow,
  WordPressRedirectRow,
  WordPressRouteBundle,
  WordPressTermRow,
  WordPressUserRow,
} from "./types";

/**
 * Runs a single read-only query against the WordPress database and returns
 * rows. `WordPressRepository` never opens a connection itself (no SSH, no
 * mysql client) — the caller supplies this, e.g. by wrapping
 * `scripts/migration-inspect-wordpress-db.ts`'s SSH + `mysql
 * --defaults-extra-file` approach.
 */
export type WordPressQueryExecutor = <T>(
  query: string,
  params?: readonly unknown[],
) => Promise<T[]>;

function groupByPostId<T extends { post_id: number }>(rows: readonly T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const row of rows) {
    const existing = map.get(row.post_id);
    if (existing) {
      existing.push(row);
    } else {
      map.set(row.post_id, [row]);
    }
  }
  return map;
}

function groupPostMetaByKey(rows: readonly WordPressPostMetaRow[]): WordPressPostMetaByKey {
  const grouped: Record<string, string[]> = {};
  for (const row of rows) {
    if (row.meta_value === null) continue;
    const existing = grouped[row.meta_key];
    if (existing) {
      existing.push(row.meta_value);
    } else {
      grouped[row.meta_key] = [row.meta_value];
    }
  }
  return grouped;
}

export class WordPressRepository {
  constructor(private readonly executor: WordPressQueryExecutor) {}

  async getPublishedArticles(limit?: number): Promise<WordPressArticleBundle[]> {
    const { sql, params } = buildPublishedArticlesQuery(clampLimit(limit));
    const posts = await this.executor<WordPressPostRow>(sql, params);
    return this.assemblePostBundles(posts);
  }

  async getPublishedArticleById(postId: number): Promise<WordPressArticleBundle | null> {
    const { sql, params } = buildPublishedArticleByIdQuery(postId);
    const posts = await this.executor<WordPressPostRow>(sql, params);
    const bundles = await this.assemblePostBundles(posts);
    return bundles[0] ?? null;
  }

  async getPublishedPlaces(limit?: number): Promise<WordPressPlaceBundle[]> {
    const { sql, params } = buildPublishedPlacesQuery(clampLimit(limit));
    const posts = await this.executor<WordPressPostRow>(sql, params);
    const postIds = posts.map((post) => post.ID);

    const [postMetaByPost, termsByPost, placeIndexByPost] = await Promise.all([
      this.getPostMeta(postIds),
      this.getTerms(postIds),
      this.getPlaceIndexRows(postIds),
    ]);

    return posts.map((post) => ({
      post,
      postMeta: groupPostMetaByKey(postMetaByPost.get(post.ID) ?? []),
      terms: termsByPost.get(post.ID) ?? [],
      placeIndex: placeIndexByPost.get(post.ID) ?? null,
    }));
  }

  /**
   * `post_status = 'publish'` only (enforced in `buildPublishedEventsQuery`
   * itself) — WP's `draft`/`expired`/`auto-draft` event rows never reach
   * this repository at all, per the Phoenix v1 eligibility decision.
   */
  async getPublishedEvents(limit?: number): Promise<WordPressEventBundle[]> {
    const { sql, params } = buildPublishedEventsQuery(clampLimit(limit));
    const posts = await this.executor<WordPressPostRow>(sql, params);
    return this.assemblePostBundles(posts);
  }

  async getPublishedEventById(postId: number): Promise<WordPressEventBundle | null> {
    const { sql, params } = buildPublishedEventByIdQuery(postId);
    const posts = await this.executor<WordPressPostRow>(sql, params);
    const bundles = await this.assemblePostBundles(posts);
    return bundles[0] ?? null;
  }

  /**
   * No place-index/geo lookup here (see `WordPressRouteBundle` — routes
   * have no equivalent to `wp_voxel_index_places`), just post + postmeta +
   * terms, same shape as events.
   */
  async getPublishedRoutes(limit?: number): Promise<WordPressRouteBundle[]> {
    const { sql, params } = buildPublishedRoutesQuery(clampLimit(limit));
    const posts = await this.executor<WordPressPostRow>(sql, params);
    return this.assemblePostBundles(posts);
  }

  async getPublishedRouteById(postId: number): Promise<WordPressRouteBundle | null> {
    const { sql, params } = buildPublishedRouteByIdQuery(postId);
    const posts = await this.executor<WordPressPostRow>(sql, params);
    const bundles = await this.assemblePostBundles(posts);
    return bundles[0] ?? null;
  }

  private async assemblePostBundles(
    posts: readonly WordPressPostRow[],
  ): Promise<WordPressArticleBundle[]> {
    const postIds = posts.map((post) => post.ID);
    const [postMetaByPost, termsByPost] = await Promise.all([
      this.getPostMeta(postIds),
      this.getTerms(postIds),
    ]);

    return posts.map((post) => ({
      post,
      postMeta: groupPostMetaByKey(postMetaByPost.get(post.ID) ?? []),
      terms: termsByPost.get(post.ID) ?? [],
    }));
  }

  async getPostMeta(postIds: readonly number[]): Promise<Map<number, WordPressPostMetaRow[]>> {
    if (postIds.length === 0) return new Map();
    const { sql, params } = buildPostMetaQuery(postIds);
    const rows = await this.executor<WordPressPostMetaRow>(sql, params);
    return groupByPostId(rows);
  }

  async getTerms(postIds: readonly number[]): Promise<Map<number, WordPressTermRow[]>> {
    if (postIds.length === 0) return new Map();
    const { sql, params } = buildTermsQuery(postIds);
    const rows = await this.executor<WordPressTermRow>(sql, params);
    return groupByPostId(rows);
  }

  async getPlaceIndexRows(
    postIds: readonly number[],
  ): Promise<Map<number, WordPressPlaceIndexRow>> {
    const map = new Map<number, WordPressPlaceIndexRow>();
    if (postIds.length === 0) return map;

    const { sql, params } = buildPlaceIndexQuery(postIds);
    const rows = await this.executor<WordPressPlaceIndexRow>(sql, params);
    for (const row of rows) {
      map.set(row.post_id, row);
    }
    return map;
  }

  async getAttachmentsByIds(
    ids: readonly number[],
  ): Promise<Map<number, WordPressAttachmentRow>> {
    const map = new Map<number, WordPressAttachmentRow>();
    if (ids.length === 0) return map;

    const { sql, params } = buildAttachmentsQuery(ids);
    const rows = await this.executor<WordPressAttachmentRow>(sql, params);
    for (const row of rows) {
      map.set(row.ID, row);
    }
    return map;
  }

  async getRankMathRedirects(limit?: number): Promise<WordPressRedirectRow[]> {
    const { sql, params } = buildRankMathRedirectsQuery(clampLimit(limit));
    return this.executor<WordPressRedirectRow>(sql, params);
  }

  async getUsers(limit?: number): Promise<WordPressUserRow[]> {
    const { sql, params } = buildUsersQuery(clampLimit(limit));
    return this.executor<WordPressUserRow>(sql, params);
  }
}
