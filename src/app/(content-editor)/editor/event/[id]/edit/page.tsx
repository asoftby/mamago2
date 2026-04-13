import { notFound, redirect } from "next/navigation";
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
import { loadEventForWizard } from "@/lib/content-editor/loadEventForWizard";
import { canEditEventActivity } from "@/lib/permissions/eventEditPermissions";
import { parseEventEditorStepQuery } from "@/lib/business/eventEditorStepQuery";
import { TOTAL_EVENT_WIZARD_STEPS } from "@/components/business/wizard/event/eventWizardSteps.config";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

function surfaceFromUserRole(role: string): ContentEditorSurface {
  return role === "ADMIN" || role === "MODERATOR" ? "admin" : "business";
}

export default async function EditorEditEventPage({
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
  const parsedStep = parseEventEditorStepQuery(
    typeof stepRaw === "string" ? stepRaw : null,
  );
  const initialEditStep =
    parsedStep != null &&
    parsedStep >= 1 &&
    parsedStep <= TOTAL_EVENT_WIZARD_STEPS
      ? parsedStep
      : undefined;

  const { event, eventForWizard } = await loadEventForWizard(id);

  if (!event || !eventForWizard) {
    notFound();
  }

  if (!(await canEditEventActivity(user, event))) {
    if (user.role === "BUSINESS_OWNER") {
      redirect(
        buildSurfaceRedirectDestination({
          targetSurface: "business",
          targetPath: "/events",
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
      legalName: true,
      phone: true,
    },
  });

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
      title="Редактирование события"
      backHref={backHref}
      surface={surface}
    >
      <EventWizard
        mode="edit"
        event={eventForWizard}
        userId={user.id}
        userRole={user.role}
        business={businessProps}
        editorSurface={surface}
        contentEditorNav={nav}
        returnTo={returnTo}
        initialEditStep={initialEditStep}
      />
    </ContentEditorChrome>
  );
}
