/**
 * Unsubscribe Link Generation
 * 
 * Helper functions for generating unsubscribe URLs for email templates.
 */

import { createUnsubscribeToken } from "@/lib/auth/unsubscribe-token";
import { getPublicAppUrl } from "./email-links";

/**
 * Build an unsubscribe URL for a user.
 * 
 * Creates an opaque token that does not expose userId in URL.
 * 
 * @param userId - User ID to create unsubscribe link for
 * @returns Full unsubscribe URL with opaque token
 * 
 * @example
 * const url = await buildUnsubscribeUrl("user_123");
 * // Returns: "https://mamago.by/u/a1b2c3d4e5f6..." (random token)
 */
export async function buildUnsubscribeUrl(userId: string): Promise<string> {
  const token = await createUnsubscribeToken(userId);
  const baseUrl = getPublicAppUrl();
  return `${baseUrl}/u/${encodeURIComponent(token)}`;
}
