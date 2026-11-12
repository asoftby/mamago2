/** Nearby home sections are strictly a fallback to the local section. */
export async function loadNearbyOnlyWhenEmpty<T, U>(
  local: Promise<readonly T[]>,
  getNearby: () => Promise<U[]>,
): Promise<U[]> {
  const items = await local;
  return items.length ? [] : getNearby();
}
