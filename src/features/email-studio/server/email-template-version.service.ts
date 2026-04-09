import prisma from "@/lib/prisma";
import {
  mapEmailTemplateVersionRecord,
  mapEmailTemplateVersionSummaryRecord,
  parseEmailTemplateDocumentFromPrismaJson,
  serializeEmailTemplateDocumentForPrisma,
  type EmailTemplateVersionPrismaRecord,
  type EmailTemplateVersionSummary,
  type EmailTemplateVersionSummaryPrismaRecord,
  type EmailTemplateVersionWithDocument,
} from "@/features/email-studio/server/email-template.mapper";
import { createEmailTemplateNotFoundError } from "@/features/email-studio/server/email-template.errors";

export type CreateEmailTemplateVersionSnapshotInput = {
  createdByUserId?: string | null;
  version?: number;
};

const emailTemplateVersionSelect = {
  id: true,
  templateId: true,
  version: true,
  subject: true,
  preheader: true,
  fromName: true,
  blocksJson: true,
  createdAt: true,
  createdByUserId: true,
  createdByUser: {
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  },
} as const;

const emailTemplateVersionSummarySelect = {
  id: true,
  templateId: true,
  version: true,
  createdAt: true,
  createdByUserId: true,
  createdByUser: {
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  },
} as const;

async function assertTemplateExists(templateId: string): Promise<void> {
  const template = await prisma.emailTemplate.findUnique({
    where: { id: templateId },
    select: { id: true },
  });

  if (!template) {
    throw createEmailTemplateNotFoundError(templateId);
  }
}

export async function createVersionSnapshot(
  templateId: string,
  input: CreateEmailTemplateVersionSnapshotInput = {},
): Promise<EmailTemplateVersionWithDocument> {
  const template = await prisma.emailTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      version: true,
      subject: true,
      preheader: true,
      fromName: true,
      blocksJson: true,
    },
  });

  if (!template) {
    throw createEmailTemplateNotFoundError(templateId);
  }

  const snapshotVersion = input.version ?? template.version + 1;

  const created = await prisma.emailTemplateVersion.create({
    data: {
      templateId: template.id,
      version: snapshotVersion,
      subject: template.subject,
      preheader: template.preheader,
      fromName: template.fromName,
      blocksJson: serializeEmailTemplateDocumentForPrisma(
        parseEmailTemplateDocumentFromPrismaJson(template.blocksJson),
      ),
      createdByUserId: input.createdByUserId ?? null,
    },
    select: emailTemplateVersionSelect,
  });

  return mapEmailTemplateVersionRecord(created as EmailTemplateVersionPrismaRecord);
}

export async function listTemplateVersions(
  templateId: string,
): Promise<EmailTemplateVersionSummary[]> {
  await assertTemplateExists(templateId);

  const rows = await prisma.emailTemplateVersion.findMany({
    where: { templateId },
    orderBy: [{ version: "desc" }],
    select: emailTemplateVersionSummarySelect,
  });

  return rows.map((row) =>
    mapEmailTemplateVersionSummaryRecord(row as EmailTemplateVersionSummaryPrismaRecord),
  );
}
