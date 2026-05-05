import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import prisma from "@/lib/prisma";
import { OfferWizard } from "@/components/business/wizard/offer/OfferWizard";
import { ContentEditorChrome } from "@/components/content-editor/ContentEditorChrome";
import {
  defaultEditorNav,
  resolveEditorReturnDestination,
  type ContentEditorSurface,
} from "@/lib/content-editor/types";
import { buildSurfaceRedirectDestination, resolveSurfaceFromHostAndPathname } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

function surfaceFromHostAndPath(host: string | undefined, pathname: string): ContentEditorSurface {
  const resolved = resolveSurfaceFromHostAndPathname(host, pathname);
  // Editor is only available on business and admin surfaces
  return resolved === "admin" ? "admin" : "business";
}

export default async function EditorNewOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; placeId?: string }>;
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

  const business = await prisma.business.findUnique({
    where: { ownerUserId: user.id },
    select: {
      id: true,
      name: true,
      phone: true,
    },
  });

  if (!business && user.role === "BUSINESS_OWNER") {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "business",
        targetPath: "/onboarding",
        ...routing,
      }),
    );
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
  const surface = surfaceFromHostAndPath(routing.currentHost, "/editor/offer/new");
  const nav = defaultEditorNav(surface, "offer");
  const backHref = resolveEditorReturnDestination({
    surface,
    entity: "offer",
    returnTo,
    ...routing,
  });

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
