import { formatSharedPrice } from "@/domain/pricing/structuredPrice";
import type { ArticleMvpResolvedBlock } from "@/lib/article/articleMvpRenderData";
import type { ArticlePerformanceBlockDescriptor } from "@/lib/article/articlePerformanceAnalytics";

export type StructuredResolvedBlock = Extract<
  ArticleMvpResolvedBlock,
  { type: "contacts" | "price" | "openingHours" | "info" }
>;

export function structuredDescriptor(block: StructuredResolvedBlock): ArticlePerformanceBlockDescriptor {
  const subject = block.subject;
  return {
    blockId: block.id,
    blockType: block.type,
    ...(subject?.id ? { subjectId: subject.id } : {}),
    ...(subject?.title ? { subjectTitle: subject.title } : {}),
    ...(subject?.source ? { subjectSource: subject.source } : {}),
    ...(subject?.catalogEntityType ? { catalogEntityType: subject.catalogEntityType } : {}),
    ...(subject?.catalogEntityId ? { catalogEntityId: subject.catalogEntityId } : {}),
  };
}

/** Keep analytics impressions aligned with the exact omission rules used by ArticleInfoCard. */
export function structuredBlockRenders(block: StructuredResolvedBlock): boolean {
  if (block.type === "info") {
    return Boolean(
      block.data.locations.length || block.data.email || block.data.website || block.data.phones.length ||
      block.data.socials.length || block.data.price || block.data.openingHours,
    );
  }
  if (block.type === "contacts") {
    const data = block.data;
    return Boolean(
      data.address || data.email || data.website || data.mapUrl || data.coordinates || data.phones.length || data.socials.length,
    );
  }
  if (block.type === "price") {
    return Boolean(formatSharedPrice(block.data) || block.data.items.length || block.data.note.trim());
  }
  return !(
    block.data.mode === "WEEKLY" &&
    !block.data.rules.some((rule) => rule.isOpen) &&
    block.data.exceptions.length === 0 &&
    !block.data.note
  );
}
