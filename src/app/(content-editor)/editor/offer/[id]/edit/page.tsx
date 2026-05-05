import { notFound, redirect } from "next/navigation";
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
import { loadOfferForWizard } from "@/lib/content-editor/loadOfferForWizard";
import { canEditOfferForUser } from "@/lib/permissions/offerEditPermissions";
import { buildSurfaceRedirectDestination, resolveSurfaceFromHostAndPathname } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

function surfaceFromHostAndPath(host: string | undefined, pathname: string): ContentEditorSurface {
  const resolved = resolveSurfaceFromHostAndPathname(host, pathname);
  // Editor is only available on business and admin surfaces
  return resolved === "admin" ? "admin" : "business";
}

export default async function EditorEditOfferPage({
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

  const { offer, offerForWizard } = await loadOfferForWizard(id);

  if (!offer || !offerForWizard) {
    notFound();
  }

  const canEdit = await canEditOfferForUser(user, offer);
  if (!canEdit) {
    if (user.role === "BUSINESS_OWNER") {
      redirect(
        buildSurfaceRedirectDestination({
          targetSurface: "business",
          targetPath: "/offers",
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

  const surface = surfaceFromHostAndPath(routing.currentHost, `/editor/offer/${id}/edit`);
  const nav = defaultEditorNav(surface, "offer");
  const backHref = resolveEditorReturnDestination({
    surface,
    entity: "offer",
    returnTo,
    ...routing,
  });

  return (
    <ContentEditorChrome
      title="Редактирование предложения"
      backHref={backHref}
      surface={surface}
    >
      <OfferWizard
        mode="edit"
        offer={offerForWizard}
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
      />
    </ContentEditorChrome>
  );
}
