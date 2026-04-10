import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { canEditPlace } from "@/lib/permissions/placeEditPermissions";
import { PlaceWizard } from "@/components/business/wizard/place/PlaceWizard";
import { ContentEditorChrome } from "@/components/content-editor/ContentEditorChrome";
import {
  defaultNavForSurface,
  resolveEditorReturnDestination,
  type ContentEditorSurface,
} from "@/lib/content-editor/types";
import { loadPlaceForWizard } from "@/lib/content-editor/loadPlaceForWizard";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

function surfaceFromUserRole(role: string): ContentEditorSurface {
  return role === "ADMIN" || role === "MODERATOR" ? "admin" : "business";
}

export default async function EditorEditPlacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const routing = await getCurrentRequestRoutingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/login",
        ...routing,
      }),
    );
  }

  const { id } = await params;
  const { returnTo } = await searchParams;

  const { place, placeForWizard } = await loadPlaceForWizard(id);

  if (!place || !placeForWizard) {
    notFound();
  }

  const canEdit = await canEditPlace(user, {
    placeId: place.id,
    createdByUserId: place.createdByUserId,
    ownerBusinessId: place.ownerBusinessId,
    status: place.status,
  });

  if (!canEdit) {
    if (user.role === "BUSINESS_OWNER") {
      redirect(
        buildSurfaceRedirectDestination({
          targetSurface: "business",
          targetPath: "/places",
          ...routing,
        }),
      );
    }
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/login",
        ...routing,
      }),
    );
  }

  const surface = surfaceFromUserRole(user.role);
  const nav = defaultNavForSurface(surface);
  const backHref = resolveEditorReturnDestination({
    surface,
    entity: "place",
    returnTo,
    ...routing,
  });

  const title =
    place.status === "PUBLISHED" ? "Редактирование места" : "Место — черновик";

  return (
    <ContentEditorChrome title={title} backHref={backHref} surface={surface}>
      <PlaceWizard
        mode="edit"
        place={placeForWizard}
        userId={user.id}
        userRole={user.role}
        editorSurface={surface}
        contentEditorNav={nav}
        returnTo={returnTo}
      />
    </ContentEditorChrome>
  );
}
