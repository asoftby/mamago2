/**
 * Data Policy: System Entity Guard
 *
 * System entities (isSystem = true) are seeded by the platform and cannot be:
 * - Hard deleted
 * - Have their key (slug/value) changed
 *
 * They CAN have their display name, description, sortOrder, and isActive changed.
 */

export class SystemEntityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SystemEntityError";
  }
}

/**
 * Throws if attempting to delete a system entity.
 */
export function assertNotSystemDelete(entity: { isSystem?: boolean; slug?: string }): void {
  if (entity.isSystem) {
    throw new SystemEntityError(
      `Cannot delete system entity "${entity.slug ?? "(unknown)"}". System entities are protected.`,
    );
  }
}

/**
 * Throws if attempting to change the key (slug/value) of a system entity.
 */
export function assertNotSystemKeyChange(
  entity: { isSystem?: boolean; slug?: string },
  newSlug: string | undefined,
): void {
  if (entity.isSystem && newSlug !== undefined && newSlug !== entity.slug) {
    throw new SystemEntityError(
      `Cannot change slug of system entity "${entity.slug}". The key is immutable.`,
    );
  }
}

/**
 * Returns a 403 JSON-compatible error payload for API routes.
 */
export function systemEntityErrorResponse(e: unknown): { error: string } | null {
  if (e instanceof SystemEntityError) {
    return { error: e.message };
  }
  return null;
}
