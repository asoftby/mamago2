/**
 * Hardcoded, read-only SELECT builders for the WordPress source database.
 * Nothing here accepts arbitrary SQL or unescaped identifiers from a
 * caller — every dynamic value is a bound `?` parameter, never string
 * interpolation.
 */

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
    sql: `SELECT ID, post_title, post_name, post_mime_type, guid, post_parent
      FROM wp_posts
      WHERE post_type = 'attachment' AND ID IN (${placeholders(ids.length)})`,
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
