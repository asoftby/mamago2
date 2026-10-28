/**
 * Iterate catalog IDs with a bounded DB page and bounded concurrent index writes.
 * The caller must order pages by a stable unique ID and use cursor + skip: 1.
 * A full rebuild is a maintenance operation, not a snapshot of concurrent edits.
 */
export async function walkSearchIndexIds(
  fetchPage: (cursor?: string) => Promise<ReadonlyArray<{ id: string }>>,
  upsert: (id: string) => Promise<void>,
): Promise<void> {
  let cursor: string | undefined;
  while (true) {
    const rows = await fetchPage(cursor);
    if (rows.length === 0) return;
    await Promise.all(rows.map(({ id }) => upsert(id)));
    const lastId = rows[rows.length - 1].id;
    if (lastId === cursor) throw new Error("Search reindex cursor did not advance");
    cursor = lastId;
  }
}
