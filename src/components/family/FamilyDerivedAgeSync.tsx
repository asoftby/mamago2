"use client";

/**
 * Previously this global effect copied FamilyPersonaContext selections into
 * discovery age filters and the `profile` URL parameter, including on login.
 * That implicitly narrowed catalog results and leaked persona IDs in URLs.
 *
 * Family context is now ranking-only by default. Explicit age-chip selection
 * remains responsible for updating the discovery `age` filter.
 *
 * Keep the mounted component as a compatibility shim until the old provider
 * wiring is removed in a separate change.
 */
export function FamilyDerivedAgeSync() {
  return null;
}
