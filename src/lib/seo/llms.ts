import "server-only";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import { getDefaultLlmsTxtContent } from "@/lib/seo/llms-default";

export const LLMS_TXT_MAX_LENGTH = 100_000;

export const SeoLlmsTxtInputSchema = z.object({
  content: z.string().max(LLMS_TXT_MAX_LENGTH),
  isEnabled: z.boolean(),
});

export type SeoLlmsTxtInput = z.infer<typeof SeoLlmsTxtInputSchema>;

export type SeoLlmsTxtSnapshot = {
  citySlug: string | null;
  content: string;
  isEnabled: boolean;
  updatedAt: string | null;
  createdAt: string | null;
  source: "database" | "default";
  publicUrl: string;
};

function buildLlmsTxtPublicUrl(): string {
  return `${getCanonicalPublicAppUrl()}/llms.txt`;
}

async function findLlmsTxtRecord(citySlug: string | null) {
  if (citySlug === null) {
    return prisma.seoLlmsTxt.findFirst({
      where: { citySlug: null },
      orderBy: [{ createdAt: "asc" }],
    });
  }

  return prisma.seoLlmsTxt.findUnique({
    where: { citySlug },
  });
}

function resolveSnapshotFromRecord(
  record: {
    citySlug: string | null;
    content: string;
    isEnabled: boolean;
    updatedAt: Date;
    createdAt: Date;
  } | null,
  citySlug: string | null,
): SeoLlmsTxtSnapshot {
  const defaultContent = getDefaultLlmsTxtContent();
  const recordContent = record?.content ?? "";
  const hasCustomContent = recordContent.trim().length > 0;

  return {
    citySlug,
    content: hasCustomContent ? recordContent : defaultContent,
    isEnabled: record?.isEnabled ?? true,
    updatedAt: record?.updatedAt.toISOString() ?? null,
    createdAt: record?.createdAt.toISOString() ?? null,
    source: hasCustomContent ? "database" : "default",
    publicUrl: buildLlmsTxtPublicUrl(),
  };
}

export async function getLlmsTxtSnapshot(
  citySlug: string | null = null,
): Promise<SeoLlmsTxtSnapshot> {
  const record = await findLlmsTxtRecord(citySlug);
  return resolveSnapshotFromRecord(record, citySlug);
}

export async function getPublicLlmsTxtContent(
  citySlug: string | null = null,
): Promise<string | null> {
  const record = await findLlmsTxtRecord(citySlug);

  if (record && !record.isEnabled) {
    return null;
  }

  if (!record) {
    return getDefaultLlmsTxtContent();
  }

  return record.content.trim().length > 0
    ? record.content
    : getDefaultLlmsTxtContent();
}

export async function saveLlmsTxtSnapshot(
  input: SeoLlmsTxtInput,
  citySlug: string | null = null,
): Promise<SeoLlmsTxtSnapshot> {
  const record = await findLlmsTxtRecord(citySlug);

  const saved = record
    ? await prisma.seoLlmsTxt.update({
        where: { id: record.id },
        data: {
          content: input.content,
          isEnabled: input.isEnabled,
        },
      })
    : await prisma.seoLlmsTxt.create({
        data: {
          citySlug,
          content: input.content,
          isEnabled: input.isEnabled,
        },
      });

  return resolveSnapshotFromRecord(saved, citySlug);
}
