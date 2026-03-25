import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import prisma from "@/lib/prisma";
import { OfferWizard } from "@/components/business/wizard/offer/OfferWizard";
import { ContentEditorChrome } from "@/components/content-editor/ContentEditorChrome";
import {
  defaultEditorNav,
  type ContentEditorSurface,
} from "@/lib/content-editor/types";
import { loadOfferForWizard } from "@/lib/content-editor/loadOfferForWizard";
import { canEditOfferForUser } from "@/lib/permissions/offerEditPermissions";

function surfaceFromUserRole(role: string): ContentEditorSurface {
  return role === "ADMIN" || role === "MODERATOR" ? "admin" : "business";
}

export default async function EditorEditOfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || !canCreateBusinessContent(user.role)) {
    redirect("/business/login");
  }

  const { id } = await params;
  const { returnTo } = await searchParams;

  const { offer, offerForWizard } = await loadOfferForWizard(id);

  if (!offer || !offerForWizard) {
    notFound();
  }

  if (!canEditOfferForUser(user, offer)) {
    if (user.role === "BUSINESS_OWNER") {
      redirect("/business/offers");
    }
    redirect("/login");
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

  const surface = surfaceFromUserRole(user.role);
  const nav = defaultEditorNav(surface, "offer");
  const backHref = returnTo ?? nav.afterSubmitListPath;

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
