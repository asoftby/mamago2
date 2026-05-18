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
import { parsePlaceEditorStepQuery } from "@/lib/business/placeEditorStepQuery";
import { TOTAL_STEPS } from "@/components/business/wizard/place/config";
import { buildSurfaceRedirectDestination, resolveSurfaceFromHostAndPathname } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

function surfaceFromHostAndPath(host: string | undefined, pathname: string): ContentEditorSurface {
  const resolved = resolveSurfaceFromHostAndPathname(host, pathname);
  // Editor is only available on business and admin surfaces
  return resolved === "admin" ? "admin" : "business";
}

export default async function EditorEditPlacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string; step?: string | string[] }>;
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
  const sp = await searchParams;
  const { returnTo } = sp;
  const stepRaw = Array.isArray(sp.step) ? sp.step[0] : sp.step;
  const parsedStep = parsePlaceEditorStepQuery(
    typeof stepRaw === "string" ? stepRaw : null,
  );
  const initialEditStep =
    parsedStep != null && parsedStep >= 1 && parsedStep <= TOTAL_STEPS
      ? parsedStep
      : undefined;

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

  const surface = surfaceFromHostAndPath(routing.currentHost, `/editor/place/${id}/edit`);
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
        initialEditStep={initialEditStep}
      />
    </ContentEditorChrome>
  );
}
