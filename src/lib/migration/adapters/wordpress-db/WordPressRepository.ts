import {
  buildAttachmentsQuery,
  buildOfferPlaceRelationsQuery,
  buildPlaceIndexQuery,
  buildPostMetaQuery,
  buildPublishedArticleByIdQuery,
  buildPublishedArticlesQuery,
  buildPublishedEventByIdQuery,
  buildPublishedEventsQuery,
  buildPublishedOfferByIdQuery,
  buildPublishedOffersQuery,
  buildPublishedPlaceByIdQuery,
  buildPublishedPlacesQuery,
  buildPublishedRouteByIdQuery,
  buildPublishedRoutesQuery,
  buildRankMathRedirectsQuery,
  buildTermsQuery,
  buildUserMetaQuery,
  buildUsersQuery,
  buildVoxelPostReviewByIdQuery,
  buildVoxelPostReviewsQuery,
  clampLimit,
} from "./sql";
import type {
  WordPressArticleBundle,
  WordPressAttachmentRow,
  WordPressEventBundle,
  WordPressOfferBundle,
  WordPressOfferPlaceRelationRow,
  WordPressPlaceBundle,
  WordPressPlaceIndexRow,
  WordPressPostMetaByKey,
  WordPressPostMetaRow,
  WordPressPostRow,
  WordPressRedirectRow,
  WordPressRouteBundle,
  WordPressTermRow,
  WordPressUserMetaRow,
  WordPressUserRow,
  WordPressVoxelReviewRow,
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

/**
 * Coerces a value that the tabular SSH-mysql executor may have left as a
 * numeric-looking string (any column outside `connectExecutor.ts`'s
 * `NUMERIC_COLUMNS` allowlist, e.g. `wp_usermeta.user_id`/`umeta_id`) into a
 * real `number`. Accepts both an already-numeric value (a fake/test
 * executor, or a future column that does get added to the allowlist) and a
 * numeric string; returns `null` for anything else (empty string, `NaN`,
 * non-integer, or a non-numeric value) so callers can skip a malformed row
 * deterministically instead of keying a Map with `NaN`.
 */
function coerceMysqlNumericId(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) ? parsed : null;
}

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

  /** Targeted lookup — same assembly as `getPublishedPlaces()`, scoped to one `ID` at the SQL layer, not a client-side filter of the bulk 82-row result. */
  async getPublishedPlaceById(postId: number): Promise<WordPressPlaceBundle | null> {
    const { sql, params } = buildPublishedPlaceByIdQuery(postId);
    const posts = await this.executor<WordPressPostRow>(sql, params);
    if (posts.length === 0) return null;

    const post = posts[0];
    const [postMetaByPost, termsByPost, placeIndexByPost] = await Promise.all([
      this.getPostMeta([post.ID]),
      this.getTerms([post.ID]),
      this.getPlaceIndexRows([post.ID]),
    ]);

    return {
      post,
      postMeta: groupPostMetaByKey(postMetaByPost.get(post.ID) ?? []),
      terms: termsByPost.get(post.ID) ?? [],
      placeIndex: placeIndexByPost.get(post.ID) ?? null,
    };
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

  /**
   * Both Offer source post types (`hb-programs`, `services`) in one
   * deterministically-ordered result — see `buildPublishedOffersQuery`.
   * `placeRelations` is assembled alongside `postMeta`/`terms`, not
   * deferred to a caller: every published Offer bundle always carries
   * whatever Place relations actually exist (zero, one, or several) —
   * this repository never filters, dedupes, or picks one.
   */
  async getPublishedOffers(limit?: number): Promise<WordPressOfferBundle[]> {
    const { sql, params } = buildPublishedOffersQuery(clampLimit(limit));
    const posts = await this.executor<WordPressPostRow>(sql, params);
    return this.assembleOfferBundles(posts);
  }

  /** Targeted lookup — caller must supply the exact source post type, not just an ID (see `buildPublishedOfferByIdQuery`). */
  async getPublishedOfferById(
    sourcePostType: string,
    postId: number,
  ): Promise<WordPressOfferBundle | null> {
    const { sql, params } = buildPublishedOfferByIdQuery(sourcePostType, postId);
    const posts = await this.executor<WordPressPostRow>(sql, params);
    const bundles = await this.assembleOfferBundles(posts);
    return bundles[0] ?? null;
  }

  private async assembleOfferBundles(
    posts: readonly WordPressPostRow[],
  ): Promise<WordPressOfferBundle[]> {
    const postIds = posts.map((post) => post.ID);
    const [postMetaByPost, termsByPost, placeRelationsByPost] = await Promise.all([
      this.getPostMeta(postIds),
      this.getTerms(postIds),
      this.getOfferPlaceRelations(postIds),
    ]);

    return posts.map((post) => ({
      post,
      postMeta: groupPostMetaByKey(postMetaByPost.get(post.ID) ?? []),
      terms: termsByPost.get(post.ID) ?? [],
      placeRelations: placeRelationsByPost.get(post.ID) ?? [],
    }));
  }

  async getOfferPlaceRelations(
    postIds: readonly number[],
  ): Promise<Map<number, WordPressOfferPlaceRelationRow[]>> {
    if (postIds.length === 0) return new Map();
    const { sql, params } = buildOfferPlaceRelationsQuery(postIds);
    const rows = await this.executor<WordPressOfferPlaceRelationRow>(sql, params);
    return groupByPostId(rows.map((row) => ({
      ...row,
      post_id: Number(row.post_id),
      related_post_id: Number(row.related_post_id),
      relation_order: Number(row.relation_order),
    })));
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

  /**
   * One `meta_key` value per user, keyed by `user_id`. `wp_usermeta` has no
   * unique constraint on `(user_id, meta_key)` — if a user somehow has more
   * than one row for this key, the first one in `ORDER BY user_id, umeta_id`
   * (the earliest recorded value) wins; see `buildUserMetaQuery()`.
   *
   * `row.user_id`/`row.umeta_id` are normalized to real numbers here before
   * being used as a Map key or returned — confirmed PROD bug (2026-08-15,
   * avatar preview): the SSH `mysql --defaults-extra-file` tabular executor
   * (`connectExecutor.ts`'s `NUMERIC_COLUMNS`) only coerces a fixed column
   * allowlist that includes `post_id`/`meta_id` but not `user_id`/
   * `umeta_id`, so every row actually arrives with `user_id` as the
   * *string* `"14"` despite `WordPressUserMetaRow`'s `number` type. Building
   * the Map straight off `row.user_id` therefore produced string keys, and
   * every `avatarMetaByUser.get(row.ID)` lookup with a real `number` ID
   * missed — 0/575 eligible, though the live source had 49 valid + 18
   * broken-ref avatars. Fixed locally here (not by widening
   * `NUMERIC_COLUMNS`) because that allowlist is also relied on by
   * `WordPressVoxelReviewRow.user_id` (`buildVoxelPostReviewsQuery`), which
   * currently only works because it never does numeric comparison/Map-
   * keying on that field, just string interpolation
   * (`normalizeReview.ts`) — changing the shared parser's behavior for an
   * unrelated, already-working path to fix a bug only this new usermeta
   * path has would be a wider, riskier change than necessary.
   */
  async getUserMetaByKey(userIds: readonly number[], metaKey: string): Promise<Map<number, WordPressUserMetaRow>> {
    const map = new Map<number, WordPressUserMetaRow>();
    if (userIds.length === 0) return map;
    const { sql, params } = buildUserMetaQuery(userIds, metaKey);
    const rows = await this.executor<WordPressUserMetaRow>(sql, params);
    for (const row of rows) {
      const userId = coerceMysqlNumericId(row.user_id);
      // Malformed/unparseable user_id: skip deterministically rather than
      // create a NaN (or otherwise garbage) Map key.
      if (userId === null) continue;
      if (!map.has(userId)) {
        // umeta_id is never used as a lookup key (only carried through on
        // the returned row), so unlike user_id it doesn't need to gate
        // inclusion — coerceMysqlNumericId(...) ?? NaN keeps it a `number`
        // (satisfying WordPressUserMetaRow's type) even in the
        // never-expected-in-practice malformed case.
        map.set(userId, { ...row, user_id: userId, umeta_id: coerceMysqlNumericId(row.umeta_id) ?? NaN });
      }
    }
    return map;
  }

  async getVoxelPostReviews(limit?: number): Promise<WordPressVoxelReviewRow[]> {
    const { sql, params } = buildVoxelPostReviewsQuery(clampLimit(limit));
    return this.executor<WordPressVoxelReviewRow>(sql, params);
  }

  async getVoxelPostReviewById(id: number): Promise<WordPressVoxelReviewRow | null> {
    const { sql, params } = buildVoxelPostReviewByIdQuery(id);
    const rows = await this.executor<WordPressVoxelReviewRow>(sql, params);
    return rows[0] ?? null;
  }
}
