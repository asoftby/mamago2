import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getEditableRouteBySlug } from "@/server/services/route.service";
import { RouteEditor, makeEmptyStop } from "@/components/routes/RouteEditor";
import type { EditableRouteStop, WizardState } from "@/components/routes/RouteEditor";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return { title: `Редактировать маршрут — mamaGo`, alternates: { canonical: `/routes/${slug}/edit` } };
}

export default async function EditRoutePage({ params }: Props) {
  const { slug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const route = await getEditableRouteBySlug(slug, user.id);
  if (!route) notFound();

  const mappedStops: EditableRouteStop[] = route.stops.map((stop) => {
    const location =
      stop.placeId && stop.place
        ? {
            source: "PLACE" as const,
            placeId: stop.placeId,
            title: stop.place.title,
            address:
              stop.place.formattedAddr ??
              stop.place.shortAddress ??
              stop.address ??
              "",
            cityName: stop.place.city?.name,
            lat: stop.lat ?? undefined,
            lng: stop.lng ?? undefined,
          }
        : {
            source: "GOOGLE" as const,
            title: stop.customTitle || stop.address || "Точка маршрута",
            customTitle: stop.customTitle ?? undefined,
            address: stop.address ?? "",
            lat: stop.lat ?? undefined,
            lng: stop.lng ?? undefined,
          };

    const photos =
      stop.photoUrl
        ? [
            {
              id: stop.id,
              url: stop.photoUrl,
              width: 0,
              height: 0,
              blurhash: "",
              preview: stop.photoUrl,
            },
          ]
        : [];

    return {
      id: stop.id,
      location,
      customTitle: stop.customTitle ?? undefined,
      note: stop.note,
      photos,
      priceType: stop.priceType ?? "UNKNOWN",
      priceMin: stop.priceMin ?? null,
      priceMax: stop.priceMax ?? null,
      priceCurrency: stop.priceCurrency ?? "BYN",
      priceNote: stop.priceNote ?? "",
    };
  });

  // Ensure at least 2 stops so the wizard doesn't render broken
  while (mappedStops.length < 2) {
    mappedStops.push(makeEmptyStop());
  }

  const initialState: Partial<WizardState> = {
    title: route.title,
    ageTags: route.ageTags,
    budgetLevel: route.budgetLevel as WizardState["budgetLevel"],
    visibility: route.visibility as WizardState["visibility"],
    stops: mappedStops,
  };

  return (
    <RouteEditor
      mode="edit"
      routeId={route.id}
      initialSlug={route.slug}
      initialState={initialState}
    />
  );
}
