import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { canEditPlace } from "@/lib/permissions/placeEditPermissions";
import { PlaceWizard } from "@/components/business/wizard/place/PlaceWizard";
import { ContentEditorChrome } from "@/components/content-editor/ContentEditorChrome";
import {
  defaultNavForSurface,
  type ContentEditorSurface,
} from "@/lib/content-editor/types";
import { loadPlaceForWizard } from "@/lib/content-editor/loadPlaceForWizard";

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
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const { returnTo } = await searchParams;

  const { place, placeForWizard } = await loadPlaceForWizard(id);

  if (!place || !placeForWizard) {
    notFound();
  }

  if (
    !canEditPlace(user, {
      placeId: place.id,
      ownerUserId: place.ownerUserId,
      status: place.status,
    })
  ) {
    if (user.role === "BUSINESS_OWNER") {
      redirect("/business/places");
    }
    redirect("/login");
  }

  const surface = surfaceFromUserRole(user.role);
  const nav = defaultNavForSurface(surface);
  const backHref = returnTo ?? nav.afterSubmitListPath;

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
