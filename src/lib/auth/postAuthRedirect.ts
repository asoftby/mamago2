/**
 * Unified post-authentication redirect helper
 * 
 * After successful login or registration, ALL users should be redirected to /profile
 * regardless of their role. The /profile page will handle role-specific UI and navigation.
 */

/**
 * Get the post-authentication redirect URL
 * 
 * @returns Always returns "/profile" for consistent post-auth experience
 */
export function getPostAuthRedirect(): string {
  return "/profile";
}