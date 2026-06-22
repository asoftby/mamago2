export function resolveDraftTitle(
  value: string | null | undefined,
  fallback: string,
): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}
