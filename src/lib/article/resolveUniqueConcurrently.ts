export async function resolveUniqueConcurrently<Item, Value>(
  items: Item[],
  keyFor: (item: Item) => string | null,
  resolve: (item: Item) => Promise<Value>,
): Promise<Map<string, Value>> {
  const uniqueItems = new Map<string, Item>();
  for (const item of items) {
    const key = keyFor(item);
    if (key && !uniqueItems.has(key)) uniqueItems.set(key, item);
  }

  const entries = await Promise.all(
    [...uniqueItems].map(async ([key, item]) => [key, await resolve(item)] as const),
  );
  return new Map(entries);
}
