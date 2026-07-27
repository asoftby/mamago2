/**
 * Hardcoded, read-only SELECT builders for the WordPress source database.
 * Nothing here accepts arbitrary SQL or unescaped identifiers from a
 * caller — every dynamic value is a bound `?` parameter, never string
 * interpolation.
 */

import {
  WORDPRESS_PROGRAMS_POST_TYPE,
  WORDPRESS_SERVICES_POST_TYPE,
} from "../../planners/offerMapping";

export interface SqlQuery {
  readonly sql: string;
  readonly params: readonly unknown[];
}

export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 1000;

/** Clamp an optional caller-supplied limit into a safe, bounded range. */
export function clampLimit(limit: number | undefined, fallback: number = DEFAULT_LIMIT): number {
  const value = limit ?? fallback;
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(value), MAX_LIMIT);
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

export function buildPublishedArticlesQuery(limit: number): SqlQuery {
  return {
    sql: `SELECT ID, post_author, post_date, post_content, post_title, post_excerpt, post_status, post_name, post_modified, post_parent, guid, post_type, post_mime_type
      FROM wp_posts
      WHERE post_type = ? AND post_status = ?
      ORDER BY ID
      LIMIT ?`,
    params: ["post", "publish", limit],
  };
}

export function buildPublishedArticleByIdQuery(postId: number): SqlQuery {
  return {
    sql: `SELECT ID, post_author, post_date, post_content, post_title, post_excerpt, post_status, post_name, post_modified, post_parent, guid, post_type, post_mime_type
      FROM wp_posts
      WHERE post_type = ? AND post_status = ? AND ID = ?
      LIMIT 1`,
    params: ["post", "publish", postId],
  };
}

export function buildPublishedPlacesQuery(limit: number): SqlQuery {
  return {
    sql: `SELECT ID, post_author, post_date, post_content, post_title, post_excerpt, post_status, post_name, post_modified, post_parent, guid, post_type, post_mime_type
      FROM wp_posts
      WHERE post_type = ? AND post_status = ?
      ORDER BY ID
      LIMIT ?`,
    params: ["places", "publish", limit],
  };
}

export function buildPublishedPlaceByIdQuery(postId: number): SqlQuery {
  return {
    sql: `SELECT ID, post_author, post_date, post_content, post_title, post_excerpt, post_status, post_name, post_modified, post_parent, guid, post_type, post_mime_type
      FROM wp_posts
      WHERE post_type = ? AND post_status = ? AND ID = ?
      LIMIT 1`,
    params: ["places", "publish", postId],
  };
}

/**
 * `post_status = 'publish'` only — WP's `events` post type also has
 * `draft`/`expired`/`auto-draft` rows (2,857 `expired`, 538 `draft` per
 * docs/migration/wordpress-to-mamago.md), all explicitly excluded from
 * Phoenix v1 by this WHERE clause, not by later filtering.
 */
export function buildPublishedEventsQuery(limit: number): SqlQuery {
  return {
    sql: `SELECT ID, post_author, post_date, post_content, post_title, post_excerpt, post_status, post_name, post_modified, post_parent, guid, post_type, post_mime_type
      FROM wp_posts
      WHERE post_type = ? AND post_status = ?
      ORDER BY ID
      LIMIT ?`,
    params: ["events", "publish", limit],
  };
}

export function buildPublishedEventByIdQuery(postId: number): SqlQuery {
  return {
    sql: `SELECT ID, post_author, post_date, post_content, post_title, post_excerpt, post_status, post_name, post_modified, post_parent, guid, post_type, post_mime_type
      FROM wp_posts
      WHERE post_type = ? AND post_status = ? AND ID = ?
      LIMIT 1`,
    params: ["events", "publish", postId],
  };
}

/**
 * `post_status = 'publish'` only — confirmed live (2026-07-13) that all 14
 * real `routes` rows are `publish` anyway, but the filter is still
 * explicit here rather than assumed, same as every other published-* query
 * in this file.
 */
export function buildPublishedRoutesQuery(limit: number): SqlQuery {
  return {
    sql: `SELECT ID, post_author, post_date, post_content, post_title, post_excerpt, post_status, post_name, post_modified, post_parent, guid, post_type, post_mime_type
      FROM wp_posts
      WHERE post_type = ? AND post_status = ?
      ORDER BY ID
      LIMIT ?`,
    params: ["routes", "publish", limit],
  };
}

export function buildPublishedRouteByIdQuery(postId: number): SqlQuery {
  return {
    sql: `SELECT ID, post_author, post_date, post_content, post_title, post_excerpt, post_status, post_name, post_modified, post_parent, guid, post_type, post_mime_type
      FROM wp_posts
      WHERE post_type = ? AND post_status = ? AND ID = ?
      LIMIT 1`,
    params: ["routes", "publish", postId],
  };
}

/**
 * Offer has two source post types (`hb-programs`, `services`) sharing one
 * target — `post_type IN (?, ?)`, `post_status = 'publish'` only (draft rows
 * — 2 `hb-programs` as of 2026-07-14 — never reach this query; they stay
 * staging/inventory-only per product decision, not silently dropped
 * elsewhere). `ORDER BY post_type, ID` keeps result order deterministic
 * across the two source types instead of relying on insertion order.
 */
export function buildPublishedOffersQuery(limit: number): SqlQuery {
  return {
    sql: `SELECT ID, post_author, post_date, post_content, post_title, post_excerpt, post_status, post_name, post_modified, post_parent, guid, post_type, post_mime_type
      FROM wp_posts
      WHERE post_type IN (?, ?) AND post_status = ?
      ORDER BY post_type, ID
      LIMIT ?`,
    params: [WORDPRESS_SERVICES_POST_TYPE, WORDPRESS_PROGRAMS_POST_TYPE, "publish", limit],
  };
}

/** Targeted lookup: caller supplies the exact source post type (`hb-programs` | `services`), not just an ID. */
export function buildPublishedOfferByIdQuery(sourcePostType: string, postId: number): SqlQuery {
  return {
    sql: `SELECT ID, post_author, post_date, post_content, post_title, post_excerpt, post_status, post_name, post_modified, post_parent, guid, post_type, post_mime_type
      FROM wp_posts
      WHERE post_type = ? AND post_status = ? AND ID = ?
      LIMIT 1`,
    params: [sourcePostType, "publish", postId],
  };
}

/**
 * `wp_voxel_relations` has no fixed parent/child convention per relation
 * key — inspection (2026-07-14) found real Offer↔Place relations stored in
 * both directions. Both halves of this `UNION ALL` are scoped to the
 * caller's own Offer post IDs (`postIds`, always already known
 * `hb-programs`/`services` rows — no extra post_type filter needed on that
 * side), and both join to `wp_posts` only to confirm the *other* side is
 * genuinely a `places` post, not to resolve anything else. `` `order` ``
 * is backtick-quoted — it is a real column name in `wp_voxel_relations`
 * and also a reserved SQL keyword.
 */
export function buildOfferPlaceRelationsQuery(postIds: readonly number[]): SqlQuery {
  const ph = placeholders(postIds.length);
  return {
    sql: `SELECT r.parent_id AS post_id, r.child_id AS related_post_id, p2.post_type AS related_post_type, r.relation_key, r.\`order\` AS relation_order, 'child' AS relation_side
      FROM wp_voxel_relations r
      JOIN wp_posts p2 ON p2.ID = r.child_id AND p2.post_type = 'places'
      WHERE r.parent_id IN (${ph})
      UNION ALL
      SELECT r.child_id AS post_id, r.parent_id AS related_post_id, p1.post_type AS related_post_type, r.relation_key, r.\`order\` AS relation_order, 'parent' AS relation_side
      FROM wp_voxel_relations r
      JOIN wp_posts p1 ON p1.ID = r.parent_id AND p1.post_type = 'places'
      WHERE r.child_id IN (${ph})
      ORDER BY post_id, relation_side, relation_order, related_post_id`,
    params: [...postIds, ...postIds],
  };
}

export function buildPostMetaQuery(postIds: readonly number[]): SqlQuery {
  return {
    sql: `SELECT meta_id, post_id, meta_key, meta_value
      FROM wp_postmeta
      WHERE post_id IN (${placeholders(postIds.length)})
      ORDER BY post_id, meta_id`,
    params: postIds,
  };
}

export function buildTermsQuery(postIds: readonly number[]): SqlQuery {
  return {
    sql: `SELECT tr.object_id AS post_id, t.term_id, t.name, t.slug, tt.taxonomy
      FROM wp_term_relationships tr
      JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
      JOIN wp_terms t ON t.term_id = tt.term_id
      WHERE tr.object_id IN (${placeholders(postIds.length)})
      ORDER BY tr.object_id, t.term_id`,
    params: postIds,
  };
}

export function buildAttachmentsQuery(ids: readonly number[]): SqlQuery {
  return {
    // A correlated scalar subquery, not a plain LEFT JOIN — wp_postmeta has
    // no unique constraint on (post_id, meta_key), so a JOIN could return
    // more than one row per attachment if a source DB ever has duplicate
    // `_wp_attached_file` rows, and the row-collapsing in
    // `WordPressRepository.getAttachmentsByIds()` would then pick whichever
    // one happened to come back last — nondeterministic. `ORDER BY meta_id
    // ASC LIMIT 1` guarantees exactly one row per attachment (the earliest
    // recorded value) regardless. Found by review (PR #51,
    // chatgpt-codex-connector) before merge.
    sql: `SELECT p.ID, p.post_title, p.post_name, p.post_mime_type, p.guid, p.post_parent,
        (SELECT pm.meta_value FROM wp_postmeta pm
          WHERE pm.post_id = p.ID AND pm.meta_key = '_wp_attached_file'
          ORDER BY pm.meta_id ASC LIMIT 1) AS attached_file
      FROM wp_posts p
      WHERE p.post_type = 'attachment' AND p.ID IN (${placeholders(ids.length)})`,
    params: ids,
  };
}

/**
 * `_location` is a native MySQL POINT column, stored as `POINT(lng, lat)`
 * — see docs/migration/wordpress-db-inspection-2026-07-06.md §4. ST_X is
 * therefore longitude, ST_Y latitude.
 */
export function buildPlaceIndexQuery(postIds: readonly number[]): SqlQuery {
  return {
    sql: `SELECT post_id, post_status, priority, ST_X(_location) AS lng, ST_Y(_location) AS lat
      FROM wp_voxel_index_places
      WHERE post_id IN (${placeholders(postIds.length)})`,
    params: postIds,
  };
}

export function buildRankMathRedirectsQuery(limit: number): SqlQuery {
  return {
    sql: `SELECT id, sources, url_to, header_code, hits, status, created, updated
      FROM wp_rank_math_redirections
      ORDER BY id
      LIMIT ?`,
    params: [limit],
  };
}

export function buildUsersQuery(limit: number): SqlQuery {
  return {
    sql: `SELECT ID, user_login, user_email, user_registered, display_name
      FROM wp_users
      ORDER BY ID
      LIMIT ?`,
    params: [limit],
  };
}

/**
 * `post_status` breakdown for a single `post_type`, with no row-level
 * data — used for a full-scope inventory count (e.g. `events`) without
 * pulling every row. No filtering by author or status: this is
 * deliberately the whole table's shape.
 */
export function buildPostTypeStatusBreakdownQuery(postType: string): SqlQuery {
  return {
    sql: `SELECT post_status, COUNT(*) AS count
      FROM wp_posts
      WHERE post_type = ?
      GROUP BY post_status
      ORDER BY post_status`,
    params: [postType],
  };
}

/**
 * Row-level posts for specific authors and post types, any status — unlike
 * `buildPublished*Query` above, this intentionally does not filter by
 * `post_status`, since the caller needs to see draft/expired/pending rows
 * too (to classify why a Place/Activity/Article hasn't been migrated).
 * Excludes `post_content`/`post_title`/`post_excerpt` — not needed for
 * dependency/status inventory, and kept out of the capture to minimize
 * what's pulled from the source database.
 */
export function buildPostsByAuthorsAndTypesQuery(authorIds: readonly number[], postTypes: readonly string[]): SqlQuery {
  return {
    sql: `SELECT ID, post_author, post_date, post_status, post_name, post_modified, post_parent, guid, post_type
      FROM wp_posts
      WHERE post_author IN (${placeholders(authorIds.length)}) AND post_type IN (${placeholders(postTypes.length)})
      ORDER BY post_author, post_type, ID`,
    params: [...authorIds, ...postTypes],
  };
}
