import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import prisma from "@/lib/prisma";
import { OfferWizard } from "@/components/business/wizard/offer/OfferWizard";
import { ContentEditorChrome } from "@/components/content-editor/ContentEditorChrome";
import {
  defaultEditorNav,
  type ContentEditorSurface,
} from "@/lib/content-editor/types";

function surfaceFromUserRole(role: string): ContentEditorSurface {
  return role === "ADMIN" || role === "MODERATOR" ? "admin" : "business";
}

export default async function EditorNewOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; placeId?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || !canCreateBusinessContent(user.role)) {
    redirect("/business/login");
  }

  const business = await prisma.business.findUnique({
    where: { ownerUserId: user.id },
    select: {
      id: true,
      name: true,
      phone: true,
    },
  });

  if (!business && user.role === "BUSINESS_OWNER") {
    redirect("/business/onboarding");
  }

  const { returnTo, placeId: placeIdParam } = await searchParams;

  let defaultPlaceId: string | null = placeIdParam ?? null;
  if (!defaultPlaceId && business) {
    const firstPlace = await prisma.place.findFirst({
      where: { 
        OR: [
          { createdByUserId: user.id },
          { ownerBusinessId: business.id },
        ],
      },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    });
    defaultPlaceId = firstPlace?.id ?? null;
  }
  const surface = surfaceFromUserRole(user.role);
  const nav = defaultEditorNav(surface, "offer");
  const backHref = returnTo ?? nav.afterSubmitListPath;

  return (
    <ContentEditorChrome
      title="Новое предложение"
      backHref={backHref}
      surface={surface}
    >
      <OfferWizard
        mode="create"
        userId={user.id}
        userRole={user.role}
        business={{
          id: business?.id ?? "platform",
          name: business?.name ?? "mamaGo",
          phone: business?.phone || undefined,
        }}
        editorSurface={surface}
        contentEditorNav={nav}
        returnTo={returnTo}
        defaultPlaceId={defaultPlaceId}
      />
    </ContentEditorChrome>
  );
}
