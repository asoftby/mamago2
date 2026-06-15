import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
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
import { buildSurfaceRedirectDestination, resolveSurfaceFromHostAndPathname } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { ExternalLink } from "lucide-react";
import { getEventStep1Taxonomies } from "@/server/admin/activities/get-activity-form-data";
import { resolveCanonicalEventPublicPathById } from "@/lib/business/resolveCanonicalEventPublicPath";
import { toAbsolutePublicUrl } from "@/lib/business/eventPublicLink";

function surfaceFromHostAndPath(host: string | undefined, pathname: string): ContentEditorSurface {
  const resolved = resolveSurfaceFromHostAndPathname(host, pathname);
  // Editor is only available on business and admin surfaces
  return resolved === "admin" ? "admin" : "business";
}

export default async function EditorEditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    returnTo?: string;
    step?: string | string[];
    importedRecordId?: string | string[];
  }>;
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
  const importedRecordIdRaw = Array.isArray(sp.importedRecordId)
    ? sp.importedRecordId[0]
    : sp.importedRecordId;
  const explicitImportedRecordId =
    typeof importedRecordIdRaw === "string" && importedRecordIdRaw.trim().length > 0
      ? importedRecordIdRaw.trim()
      : null;
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
  const initialStep1Taxonomies = await getEventStep1Taxonomies({
    selectedCategoryId: eventForWizard?.eventCategoryId ?? null,
  });


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

  const importContext = explicitImportedRecordId
    ? await prisma.importedRecord.findUnique({
        where: { id: explicitImportedRecordId },
        select: {
          id: true,
          publishedActivityId: true,
          sourceUrl: true,
          canonicalSourceUrl: true,
          source: {
            select: {
              name: true,
              slug: true,
              baseUrl: true,
            },
          },
        },
      })
    : await prisma.importedRecord.findFirst({
        where: { publishedActivityId: event.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          publishedActivityId: true,
          sourceUrl: true,
          canonicalSourceUrl: true,
          source: {
            select: {
              name: true,
              slug: true,
              baseUrl: true,
            },
          },
        },
      });
  const resolvedImportedRecordId =
    importContext?.publishedActivityId === event.id ? importContext.id : null;

  const originalUrl =
    importContext?.canonicalSourceUrl ??
    importContext?.sourceUrl ??
    importContext?.source.baseUrl ??
    null;
  const publicPath =
    event.status === "PUBLISHED"
      ? toAbsolutePublicUrl(await resolveCanonicalEventPublicPathById(event.id))
      : null;
  const headerAction =
    originalUrl || publicPath ? (
      <div className="flex items-center gap-2">
        {publicPath ? (
          <a
            href={publicPath}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Открыть на сайте
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : null}
        {originalUrl ? (
          <a
            href={originalUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Открыть оригинал
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : null}
      </div>
    ) : null;

  const surface = surfaceFromHostAndPath(routing.currentHost, `/editor/event/${id}/edit`);
  const nav = defaultEditorNav(surface, "event");
  const backHref = resolveEditorReturnDestination({
    surface,
    entity: "event",
    returnTo,
    ...routing,
  });

  const isPrivilegedUser = user.role === "ADMIN" || user.role === "MODERATOR";

  if (!business && !isPrivilegedUser) {
    redirect("/business");
  }

  const businessProps = business
    ? {
        id: business.id,
        name: business.name,
        description: business.legalName || undefined,
        phone: business.phone || undefined,
      }
    : undefined;

  return (
    <ContentEditorChrome
      title="Редактирование события"
      backHref={backHref}
      surface={surface}
      headerAction={headerAction}
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
        initialStep1Taxonomies={initialStep1Taxonomies}
        importedRecordId={resolvedImportedRecordId}
      />
    </ContentEditorChrome>
  );
}
