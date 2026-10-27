import { loadImageDimensionsByUrl } from "@/server/media/loadImageDimensionsByUrl";

type IdeaWithCover = { activity: { coverImageUrl?: string | null } };

/** Adds stored cover dimensions to saved ideas of every type (events, offers, routes, articles). */
export async function attachIdeaImageDimensions<T extends IdeaWithCover>(
  items: T[],
): Promise<Array<T & { activity: T["activity"] & { imageWidth: number | null; imageHeight: number | null } }>> {
  const dims = await loadImageDimensionsByUrl(items.map((item) => item.activity.coverImageUrl));
  return items.map((item) => {
    const url = item.activity.coverImageUrl?.trim();
    const found = url ? dims.get(url) : undefined;
    return {
      ...item,
      activity: {
        ...item.activity,
        imageWidth: found?.width ?? null,
        imageHeight: found?.height ?? null,
      },
    };
  });
}
