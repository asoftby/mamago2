import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { PlaceWizard } from "@/components/business/wizard/place/PlaceWizard";
import { ContentEditorChrome } from "@/components/content-editor/ContentEditorChrome";
import {
  defaultNavForSurface,
  resolveEditorReturnDestination,
  type ContentEditorSurface,
} from "@/lib/content-editor/types";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

function surfaceFromUserRole(role: string): ContentEditorSurface {
  return role === "ADMIN" || role === "MODERATOR" ? "admin" : "business";
}

export default async function EditorNewPlacePage({
  searchParams,
}: {
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

  const { returnTo } = await searchParams;
  const surface = surfaceFromUserRole(user.role);
  const nav = defaultNavForSurface(surface);
  const backHref = resolveEditorReturnDestination({
    surface,
    entity: "place",
    returnTo,
    ...routing,
  });

  return (
    <ContentEditorChrome
      title="Новое место"
      backHref={backHref}
      surface={surface}
    >
      <PlaceWizard
        mode="create"
        userId={user.id}
        userRole={user.role}
        editorSurface={surface}
        contentEditorNav={nav}
        returnTo={returnTo}
      />
    </ContentEditorChrome>
  );
}
