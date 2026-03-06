/**
 * Client-side auth utilities
 */

export async function getCurrentUser() {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Get current user error:", error);
    return null;
  }
}
