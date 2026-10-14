/**
 * Attaches a saved idea to its collections using the existing Ideas API.
 * Call only after the underlying idea has been persisted successfully.
 */
export type IdeaCollectionTarget = {
  activityId?: string;
  offerId?: string;
  routeId?: string;
  placeId?: string;
  articleId?: string;
};

export type IdeaCollectionSelection = {
  collectionIds?: string[];
  newCollectionTitle?: string;
  syncCollections?: boolean;
};

async function errorCode(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? String(response.status);
}

export async function persistIdeaCollectionSelection(
  selection: IdeaCollectionSelection,
  target: IdeaCollectionTarget | undefined,
): Promise<void> {
  const ids = [...new Set(selection.collectionIds ?? [])];
  const title = selection.newCollectionTitle?.trim();
  if (!selection.syncCollections && ids.length === 0 && !title) return;
  if (!target || !Object.values(target).some(Boolean)) {
    throw new Error("idea_collection_target_missing");
  }

  if (title) {
    const response = await fetch("/api/collections", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) throw new Error("collection_create_failed:" + await errorCode(response));
    const body = (await response.json()) as { collection?: { id?: string } };
    if (!body.collection?.id) throw new Error("collection_create_missing_id");
    ids.push(body.collection.id);
  }

  const response = await fetch("/api/save/idea/collections", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...target, collectionIds: ids }),
  });
  if (!response.ok) throw new Error("collection_attach_failed:" + await errorCode(response));
}
