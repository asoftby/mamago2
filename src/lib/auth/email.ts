/**
 * Email normalization utilities for consistent auth handling
 */

/**
 * Normalize email for storage and comparison
 * - Trims whitespace
 * - Converts to lowercase
 * 
 * This ensures emails like "Test@Mail.com" and "test@mail.com" 
 * are treated as the same email address.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validate email format (basic check)
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
