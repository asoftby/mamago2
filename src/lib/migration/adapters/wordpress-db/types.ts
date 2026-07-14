/**
 * Shape of the connection details a caller uses to build a
 * `WordPressQueryExecutor` (e.g. wrapping the SSH + `mysql
 * --defaults-extra-file` approach in
 * `scripts/migration-inspect-wordpress-db.ts`). `WordPressRepository` never
 * opens a connection itself and never reads this type — it only exists so
 * connection wiring has a shared, documented shape.
 */
export interface WordPressDbConfig {
  readonly sshHost: string;
  readonly sshUser: string;
  readonly dbName: string;
  readonly dbUser: string;
  readonly dbPassword: string;
  readonly tablePrefix?: string;
}

/** Subset of `wp_posts` columns relevant to Article/Place migration. */
export interface WordPressPostRow {
  ID: number;
  post_author: number;
  post_date: string;
  post_content: string;
  post_title: string;
  post_excerpt: string;
  post_status: string;
  post_name: string;
  post_modified: string;
  post_parent: number;
  guid: string;
  post_type: string;
  post_mime_type: string;
}

/** One row of `wp_postmeta`. `meta_value` can be null in WordPress. */
export interface WordPressPostMetaRow {
  meta_id: number;
  post_id: number;
  meta_key: string;
  meta_value: string | null;
}

/** A term attached to a post, flattened from the term_relationships/term_taxonomy/terms join. */
export interface WordPressTermRow {
  post_id: number;
  term_id: number;
  name: string;
  slug: string;
  taxonomy: string;
}

/** Subset of `wp_posts` columns for `post_type = 'attachment'` rows. */
export interface WordPressAttachmentRow {
  ID: number;
  post_title: string;
  post_name: string;
  post_mime_type: string;
  guid: string;
  post_parent: number;
}

/** One row of `wp_rank_math_redirections`. */
export interface WordPressRedirectRow {
  id: number;
  sources: string;
  url_to: string;
  header_code: number;
  hits: number;
  status: string;
  created: string;
  updated: string;
}

/** Subset of `wp_users` columns. Role/capability data lives in `wp_usermeta` and is out of scope here. */
export interface WordPressUserRow {
  ID: number;
  user_login: string;
  user_email: string;
  user_registered: string;
  display_name: string;
}

/**
 * One row of `wp_voxel_index_places`, with the native `_location POINT`
 * column already decomposed via `ST_X()`/`ST_Y()` in the query itself —
 * see docs/migration/wordpress-db-inspection-2026-07-06.md §4.
 */
export interface WordPressPlaceIndexRow {
  post_id: number;
  post_status: string;
  priority: number;
  lat: number | null;
  lng: number | null;
}

/** Postmeta grouped by `meta_key`, values kept as an array to preserve repeated keys (e.g. `gallery`). */
export type WordPressPostMetaByKey = Readonly<Record<string, readonly string[]>>;

export interface WordPressPostBundle {
  post: WordPressPostRow;
  postMeta: WordPressPostMetaByKey;
  terms: readonly WordPressTermRow[];
}

export type WordPressArticleBundle = WordPressPostBundle;

/**
 * No index-table equivalent to `WordPressPlaceIndexRow` — WP events have
 * no geospatial index; venue location stays raw postmeta text (see
 * `normalizeEvent.ts`).
 */
export type WordPressEventBundle = WordPressPostBundle;

export interface WordPressPlaceBundle extends WordPressPostBundle {
  placeIndex: WordPressPlaceIndexRow | null;
}

/**
 * No index-table equivalent here either (same as events) — routes have no
 * geospatial index of their own; the route-level `location` postmeta value
 * is the only coordinate source, and it isn't per-stop (see
 * `normalizeRoute.ts`).
 */
export type WordPressRouteBundle = WordPressPostBundle;

/**
 * One `wp_voxel_relations` row linking an Offer source post (`hb-programs`
 * or `services`) to a `places` post, in whichever direction it was actually
 * stored — Voxel relations aren't symmetric, and inspection
 * (2026-07-14) confirmed both directions occur in real data (a `places`
 * post as `parent_id` pointing at the offer as `child_id` is the common
 * case, but the reverse also exists). `relation_side` records which side
 * the offer post was on so a later normalizer can reason about direction
 * instead of assuming one. `relation_order` is `wp_voxel_relations.order`
 * verbatim — a possible primary/ordering signal, not yet interpreted here;
 * deciding what counts as "primary" (if anything) is normalizer/product
 * work, not this repository's job.
 */
export interface WordPressOfferPlaceRelationRow {
  post_id: number;
  related_post_id: number;
  related_post_type: string;
  relation_key: string;
  relation_order: number;
  relation_side: "parent" | "child";
}

/**
 * `post.post_type` is the discriminator between the two Offer source post
 * types (`hb-programs` | `services`) — deliberately not duplicated into a
 * separate field. `placeRelations` may be empty (source inspection
 * 2026-07-14: ~30% of published `hb-programs` have none at all) or contain
 * more than one row — this bundle reports what exists verbatim, it does
 * not pick a "primary" Place or decide anything is missing/invalid.
 */
export interface WordPressOfferBundle extends WordPressPostBundle {
  placeRelations: readonly WordPressOfferPlaceRelationRow[];
}

/**
 * `wordpress-db:{post_type}:{ID}` — every other WordPress-sourced entity
 * has exactly one source post type, so its normalizer hardcodes a single
 * `SOURCE_ENTITY_TYPE` constant (e.g. `wordpress-db:routes`) and appends
 * `:${post.ID}`. Offer has two (`hb-programs`, `services`) sharing one
 * target, so the post type itself has to be part of the key — this keeps
 * the same `wordpress-db:{source}:{id}` shape, just with `{source}` read
 * from the row instead of hardcoded. Pure string formatting only, no
 * classification or target-field decisions — deliberately kept next to the
 * bundle type so both this PR's tests and the future normalizer import the
 * same implementation instead of each hand-rolling the template.
 */
export function buildOfferSourceRecordKey(post: Pick<WordPressPostRow, "post_type" | "ID">): string {
  return `wordpress-db:${post.post_type}:${post.ID}`;
}
