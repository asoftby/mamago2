/**
 * Единый клиент быстрого создания Place (черновик) — тот же POST /api/business/places,
 * что и QuickPlaceCreate в визарде события.
 */

export type QuickPlaceCreateSource = "event_wizard" | "article_editor";

export type CreateQuickPlaceDraftInput = {
  title: string;
  formattedAddr: string;
  lat: number;
  lng: number;
  googlePlaceId: string | null;
  addressJson: unknown[];
  /** Источник — только для shortDesc по умолчанию */
  source?: QuickPlaceCreateSource;
};

export type CreatedPlaceSnapshot = {
  id: string;
  title: string;
  formattedAddr: string | null;
  customAddress: string | null;
  cityId: string | null;
  lat: number | null;
  lng: number | null;
  districtAutoId: string | null;
  districtManualId: string | null;
  metroAutoId: string | null;
  metroManualId: string | null;
  metroAutoDistanceM: number | null;
  metroManualDistanceM: number | null;
};

const SHORT_DESC: Record<QuickPlaceCreateSource, string> = {
  event_wizard: "Создано при добавлении события",
  article_editor: "Создано из редактора статьи",
};

export async function createQuickPlaceDraft(
  input: CreateQuickPlaceDraftInput,
): Promise<CreatedPlaceSnapshot> {
  const source = input.source ?? "event_wizard";
  const createRequestId = `quick-place-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  const response = await fetch("/api/business/places", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      createRequestId,
      status: "DRAFT",
      data: {
        title: input.title.trim(),
        formattedAddr: input.formattedAddr,
        lat: input.lat,
        lng: input.lng,
        googlePlaceId: input.googlePlaceId,
        addressJson: input.addressJson,
        shortDesc: SHORT_DESC[source],
        description: "",
        category: "other",
      },
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(errorData.message || errorData.error || "Не удалось создать место");
  }

  const data = (await response.json()) as { place: CreatedPlaceSnapshot };
  return data.place;
}
