import { Prisma } from "@prisma/client";
import {
  assertTemplateDocumentValid,
  normalizeTemplateDocument,
  type EmailTemplateDocument,
  type EmailTemplateStatus,
  type EmailTemplateType,
} from "@/features/email-studio/lib";

export type EmailTemplatePrismaRecord = {
  id: string;
  name: string;
  type: EmailTemplateType;
  subject: string;
  preheader: string | null;
  fromName: string | null;
  status: EmailTemplateStatus;
  version: number;
  blocksJson: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

export type EmailTemplateVersionPrismaRecord = {
  id: string;
  templateId: string;
  version: number;
  subject: string;
  preheader: string | null;
  fromName: string | null;
  blocksJson: Prisma.JsonValue;
  createdAt: Date;
  createdByUserId: string | null;
  createdByUser?: {
    id: string;
    email: string;
    displayName: string | null;
  } | null;
};

export type EmailTemplateVersionSummaryPrismaRecord = {
  id: string;
  templateId: string;
  version: number;
  createdAt: Date;
  createdByUserId: string | null;
  createdByUser?: {
    id: string;
    email: string;
    displayName: string | null;
  } | null;
};

export type EmailTemplateWithDocument = Omit<EmailTemplatePrismaRecord, "blocksJson"> & {
  document: EmailTemplateDocument;
};

export type EmailTemplateVersionActor = {
  id: string;
  email: string;
  displayName: string | null;
  label: string;
};

export type EmailTemplateVersionWithDocument = Omit<EmailTemplateVersionPrismaRecord, "blocksJson"> & {
  document: EmailTemplateDocument;
  createdBy: EmailTemplateVersionActor | null;
};

export type EmailTemplateVersionSummary = EmailTemplateVersionSummaryPrismaRecord & {
  createdBy: EmailTemplateVersionActor | null;
};

export function parseEmailTemplateDocumentFromPrismaJson(
  raw: Prisma.JsonValue | null | undefined,
): EmailTemplateDocument {
  return normalizeTemplateDocument(raw);
}

export function serializeEmailTemplateDocumentForPrisma(
  document: unknown,
): Prisma.InputJsonValue {
  const normalizedDocument = normalizeTemplateDocument(document);
  const validatedDocument = assertTemplateDocumentValid(normalizedDocument);
  return JSON.parse(JSON.stringify(validatedDocument)) as Prisma.InputJsonValue;
}

export function mapEmailTemplateRecord(row: EmailTemplatePrismaRecord): EmailTemplateWithDocument {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    subject: row.subject,
    preheader: row.preheader,
    fromName: row.fromName,
    status: row.status,
    version: row.version,
    document: parseEmailTemplateDocumentFromPrismaJson(row.blocksJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapEmailTemplateVersionRecord(
  row: EmailTemplateVersionPrismaRecord,
): EmailTemplateVersionWithDocument {
  return {
    id: row.id,
    templateId: row.templateId,
    version: row.version,
    subject: row.subject,
    preheader: row.preheader,
    fromName: row.fromName,
    document: parseEmailTemplateDocumentFromPrismaJson(row.blocksJson),
    createdAt: row.createdAt,
    createdByUserId: row.createdByUserId,
    createdBy: row.createdByUser
      ? {
          id: row.createdByUser.id,
          email: row.createdByUser.email,
          displayName: row.createdByUser.displayName,
          label: row.createdByUser.displayName?.trim() || row.createdByUser.email,
        }
      : null,
  };
}

export function mapEmailTemplateVersionSummaryRecord(
  row: EmailTemplateVersionSummaryPrismaRecord,
): EmailTemplateVersionSummary {
  return {
    id: row.id,
    templateId: row.templateId,
    version: row.version,
    createdAt: row.createdAt,
    createdByUserId: row.createdByUserId,
    createdBy: row.createdByUser
      ? {
          id: row.createdByUser.id,
          email: row.createdByUser.email,
          displayName: row.createdByUser.displayName,
          label: row.createdByUser.displayName?.trim() || row.createdByUser.email,
        }
      : null,
  };
}
