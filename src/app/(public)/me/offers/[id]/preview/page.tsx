import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { canEditOfferForUser } from "@/lib/permissions/offerEditPermissions";
import { getOfferPreviewPageDataById } from "@/lib/offer/offerPageData";
import { editorOfferEditHref } from "@/lib/content-editor/types";
import { ContentPreviewBanner } from "@/components/shared/ContentPreviewBanner";
import { OfferPageView } from "@/components/offers";

type PageProps = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  title: "Предпросмотр предложения",
  robots: { index: false, follow: false },
};

const previewBannerHint =
  "Это предпросмотр изменений. Некоторые связанные блоки могут отображаться из опубликованной версии.";

function getPreviewLabel(status: string): string {
  if (status === "PENDING") return "Предложение отправлено на модерацию";
  if (status === "DRAFT") return "Черновик предложения";
  if (status === "REJECTED") return "Предложение возвращено после модерации";
  return "Предпросмотр предложения";
}

export default async function MeOfferPreviewPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const preview = await getOfferPreviewPageDataById(id);
  if (!preview || !(await canEditOfferForUser(user, preview.offer))) {
    notFound();
  }

  const data = {
    ...preview.data,
    previewBannerLabel: getPreviewLabel(preview.offer.status),
  };

  return (
    <>
      <ContentPreviewBanner
        label={data.previewBannerLabel ?? "Предпросмотр предложения"}
        editHref={editorOfferEditHref(preview.offer.id)}
        hint={previewBannerHint}
      />
      <OfferPageView
        data={data}
        canEditOffer
        sectionNotes={{
          place: "Место показано по опубликованной версии",
          reviews: "Отзывы показаны по опубликованной версии",
        }}
      />
    </>
  );
}
