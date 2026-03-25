import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { PlaceWizard } from "@/components/business/wizard/place/PlaceWizard";
import { ContentEditorChrome } from "@/components/content-editor/ContentEditorChrome";
import {
  defaultNavForSurface,
  type ContentEditorSurface,
} from "@/lib/content-editor/types";

function surfaceFromUserRole(role: string): ContentEditorSurface {
  return role === "ADMIN" || role === "MODERATOR" ? "admin" : "business";
}

export default async function EditorNewPlacePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || !canCreateBusinessContent(user.role)) {
    redirect("/business/login");
  }

  const { returnTo } = await searchParams;
  const surface = surfaceFromUserRole(user.role);
  const nav = defaultNavForSurface(surface);
  const backHref = returnTo ?? nav.afterSubmitListPath;

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
