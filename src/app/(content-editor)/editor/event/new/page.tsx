import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import prisma from "@/lib/prisma";
import { EventWizard } from "@/components/business/wizard/event/EventWizard";
import { ContentEditorChrome } from "@/components/content-editor/ContentEditorChrome";
import {
  defaultEditorNav,
  resolveEditorReturnDestination,
  type ContentEditorSurface,
} from "@/lib/content-editor/types";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { getEventStep1Taxonomies } from "@/server/admin/activities/get-activity-form-data";

function surfaceFromUserRole(role: string): ContentEditorSurface {
  return role === "ADMIN" || role === "MODERATOR" ? "admin" : "business";
}

export default async function EditorNewEventPage({
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

  const business = await prisma.business.findUnique({
    where: { ownerUserId: user.id },
    select: {
      id: true,
      name: true,
      legalName: true,
      phone: true,
    },
  });

  const { returnTo } = await searchParams;
  const initialStep1Taxonomies = await getEventStep1Taxonomies();
  const surface = surfaceFromUserRole(user.role);
  const nav = defaultEditorNav(surface, "event");
  const backHref = resolveEditorReturnDestination({
    surface,
    entity: "event",
    returnTo,
    ...routing,
  });

  const businessProps = business
    ? {
        id: business.id,
        name: business.name,
        description: business.legalName || undefined,
        phone: business.phone || undefined,
      }
    : {
        id: "mock-business-1",
        name: "Мой бизнес",
        description: "Описание бизнеса",
        phone: "+375 29 123 45 67",
      };

  return (
    <ContentEditorChrome
      title="Новое событие"
      backHref={backHref}
      surface={surface}
    >
      <EventWizard
        mode="create"
        userId={user.id}
        userRole={user.role}
        business={businessProps}
        editorSurface={surface}
        contentEditorNav={nav}
        returnTo={returnTo}
        initialStep1Taxonomies={initialStep1Taxonomies}
      />
    </ContentEditorChrome>
  );
}
