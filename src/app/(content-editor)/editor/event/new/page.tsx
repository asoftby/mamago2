import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { EventWizard } from "@/components/business/wizard/event/EventWizard";
import { isEventCtaStepFeatureEnabled } from "@/components/business/wizard/event/ctaStepFeatureFlag";
import { ContentEditorChrome } from "@/components/content-editor/ContentEditorChrome";
import {
  defaultEditorNav,
  resolveEditorReturnDestination,
  type ContentEditorSurface,
} from "@/lib/content-editor/types";
import { buildSurfaceRedirectDestination, resolveSurfaceFromHostAndPathname } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { getEventStep1Taxonomies } from "@/server/admin/activities/get-activity-form-data";
import { getPartnerCabinetBusiness } from "@/server/permissions/business-permissions";

function surfaceFromHostAndPath(host: string | undefined, pathname: string): ContentEditorSurface {
  const resolved = resolveSurfaceFromHostAndPathname(host, pathname);
  // Editor is only available on business and admin surfaces
  return resolved === "admin" ? "admin" : "business";
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

  const { returnTo } = await searchParams;
  const initialStep1Taxonomies = await getEventStep1Taxonomies();
  const surface = surfaceFromHostAndPath(routing.currentHost, "/editor/event/new");
  const nav = defaultEditorNav(surface, "event");
  const backHref = resolveEditorReturnDestination({
    surface,
    entity: "event",
    returnTo,
    ...routing,
  });
  const ctaStepEnabled = isEventCtaStepFeatureEnabled(process.env);
  const isPlatformContentStaff = user.role === "ADMIN" || user.role === "MODERATOR";

  const business = isPlatformContentStaff
    ? null
    : await getPartnerCabinetBusiness(user.id);

  if (!isPlatformContentStaff && !business) {
    redirect("/business");
  }

  if (
    !isPlatformContentStaff &&
    business &&
    business.verificationStatus !== "APPROVED"
  ) {
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
        ctaStepEnabled={ctaStepEnabled}
      />
    </ContentEditorChrome>
  );
}
