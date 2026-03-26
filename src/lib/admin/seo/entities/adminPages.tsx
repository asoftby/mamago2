import { notFound } from "next/navigation";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import { EntitySeoEditor } from "@/components/admin/seo/EntitySeoEditor";
import type { SeoEntityType } from "./types";
import { loadEntityEditorModel } from "./service";

const TITLE: Record<SeoEntityType, string> = {
  event: "Event SEO",
  place: "Place SEO",
  offer: "Offer SEO",
  route: "Route SEO",
  article: "Article SEO",
};

const SUBTITLE: Record<SeoEntityType, string> = {
  event: "SEO-настройки публичной страницы события (контентная сущность)",
  place: "SEO-настройки публичной страницы места (контентная сущность)",
  offer: "SEO-настройки публичной страницы оффера (контентная сущность)",
  route: "SEO-настройки публичной страницы маршрута (контентная сущность)",
  article: "SEO-настройки публичной страницы статьи (контентная сущность)",
};

export async function renderEntitySeoEditorPage(kind: SeoEntityType, id: string) {
  const entity = await loadEntityEditorModel(kind, id);
  if (!entity) return notFound();
  return (
    <div className="space-y-8">
      <SeoPageHeader title={TITLE[kind]} subtitle={SUBTITLE[kind]} />
      <EntitySeoEditor kind={kind} entity={entity} />
    </div>
  );
}

