/**
 * Unified post-authentication redirect helper
 *
 * After successful login or registration (when no explicit `next` is provided),
 * regular users land on /me.
 */

/**
 * Get the post-authentication redirect URL
 */
export function getPostAuthRedirect(): string {
  return "/me";
}