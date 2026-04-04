import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import prisma from "@/lib/prisma";
import { EventWizard } from "@/components/business/wizard/event/EventWizard";
import { ContentEditorChrome } from "@/components/content-editor/ContentEditorChrome";
import {
  defaultEditorNav,
  type ContentEditorSurface,
} from "@/lib/content-editor/types";
import { loadEventForWizard } from "@/lib/content-editor/loadEventForWizard";
import { canEditEventActivity } from "@/lib/permissions/eventEditPermissions";
import { parseEventEditorStepQuery } from "@/lib/business/eventEditorStepQuery";
import { TOTAL_EVENT_WIZARD_STEPS } from "@/components/business/wizard/event/eventWizardSteps.config";

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
  const user = await getCurrentUser();

  if (!user || !canCreateBusinessContent(user.role)) {
    redirect("/business/login");
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

  if (!canEditEventActivity(user, event)) {
    if (user.role === "BUSINESS_OWNER") {
      redirect("/business/events");
    }
    redirect("/login");
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
  const backHref = returnTo ?? nav.afterSubmitListPath;

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
