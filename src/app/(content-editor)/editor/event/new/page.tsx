import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import prisma from "@/lib/prisma";
import { EventWizard } from "@/components/business/wizard/event/EventWizard";
import { ContentEditorChrome } from "@/components/content-editor/ContentEditorChrome";
import {
  defaultEditorNav,
  type ContentEditorSurface,
} from "@/lib/content-editor/types";

function surfaceFromUserRole(role: string): ContentEditorSurface {
  return role === "ADMIN" || role === "MODERATOR" ? "admin" : "business";
}

export default async function EditorNewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
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
      legalName: true,
      phone: true,
    },
  });

  const { returnTo } = await searchParams;
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
      />
    </ContentEditorChrome>
  );
}
