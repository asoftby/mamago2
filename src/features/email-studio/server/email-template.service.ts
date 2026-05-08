import type { EmailTemplateStatus, EmailTemplateType } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  assertTemplateDocumentValid,
  createStarterTemplateDocument,
  type EmailTemplateDocument,
} from "@/features/email-studio/lib";
import {
  createEmailTemplateConflictError,
  createEmailTemplateInvalidError,
  createEmailTemplateNotFoundError,
} from "@/features/email-studio/server/email-template.errors";
import {
  mapEmailTemplateRecord,
  serializeEmailTemplateDocumentForPrisma,
  type EmailTemplatePrismaRecord,
  type EmailTemplateWithDocument,
} from "@/features/email-studio/server/email-template.mapper";
import { createVersionSnapshot } from "@/features/email-studio/server/email-template-version.service";
import {
  validateEmailTemplatePublishRules,
  type EmailPublishWarning,
} from "@/features/email-studio/server/email-template-publish-guard";

export type EmailTemplateListItem = EmailTemplateWithDocument;

export type CreateEmailTemplateInput = {
  name?: string;
  type: EmailTemplateType;
  subject?: string;
  preheader?: string | null;
  fromName?: string | null;
  document?: EmailTemplateDocument;
};

export type UpdateEmailTemplateInput = {
  name?: string;
  type?: EmailTemplateType;
  subject?: string;
  preheader?: string | null;
  fromName?: string | null;
  status?: EmailTemplateStatus;
  document?: EmailTemplateDocument;
};

export type PublishEmailTemplateInput = {
  createdByUserId?: string | null;
};

export type PublishEmailTemplateResult = {
  template: EmailTemplateWithDocument;
  warning?: EmailPublishWarning;
};

const emailTemplateSelect = {
  id: true,
  name: true,
  type: true,
  subject: true,
  preheader: true,
  fromName: true,
  status: true,
  version: true,
  blocksJson: true,
  createdAt: true,
  updatedAt: true,
} as const;

function normalizeNullableString(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredString(value: string, fieldLabel: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw createEmailTemplateInvalidError(`${fieldLabel} is required.`);
  }
  return trimmed;
}

function normalizeOptionalRequiredString(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function getStarterTemplateName(type: EmailTemplateType): string {
  switch (type) {
    case "WELCOME":
      return "Welcome email";
    case "VERIFY_EMAIL":
      return "Verify email";
    case "RESET_PASSWORD":
      return "Reset password";
    case "PLAN_REMINDER":
      return "Plan reminder";
    case "WEEKLY_DIGEST":
      return "Weekly digest";
    case "PROMO_CAMPAIGN":
      return "Promo campaign";
    case "CUSTOM":
      return "Custom email";
    default: {
      const neverType: never = type;
      return neverType;
    }
  }
}

function getStarterSubject(type: EmailTemplateType): string {
  switch (type) {
    case "WELCOME":
      return "Welcome to mamaGo";
    case "VERIFY_EMAIL":
      return "Verify your email";
    case "RESET_PASSWORD":
      return "Reset your password";
    case "PLAN_REMINDER":
      return "Your plan reminder";
    case "WEEKLY_DIGEST":
      return "Your weekly digest";
    case "PROMO_CAMPAIGN":
      return "A special update from mamaGo";
    case "CUSTOM":
      return "New email";
    default: {
      const neverType: never = type;
      return neverType;
    }
  }
}

function mapTemplateRow(row: EmailTemplatePrismaRecord): EmailTemplateWithDocument {
  return mapEmailTemplateRecord(row);
}

async function requireTemplateById(id: string): Promise<EmailTemplateWithDocument> {
  const row = await prisma.emailTemplate.findUnique({
    where: { id },
    select: emailTemplateSelect,
  });

  if (!row) {
    throw createEmailTemplateNotFoundError(id);
  }

  return mapTemplateRow(row as EmailTemplatePrismaRecord);
}

function assertTemplatePublishable(template: EmailTemplateWithDocument): void {
  assertTemplateDocumentValid(template.document);

  if (!template.name.trim()) {
    throw createEmailTemplateInvalidError("Template name is required before publish.");
  }
  if (!template.subject.trim()) {
    throw createEmailTemplateInvalidError("Subject is required before publish.");
  }
  if (template.document.blocks.length === 0) {
    throw createEmailTemplateInvalidError("Template must have at least one block before publish.");
  }
}

export async function listTemplates(): Promise<EmailTemplateListItem[]> {
  const rows = await prisma.emailTemplate.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: emailTemplateSelect,
  });

  return rows.map((row) => mapTemplateRow(row as EmailTemplatePrismaRecord));
}

export async function getTemplateById(id: string): Promise<EmailTemplateWithDocument> {
  return requireTemplateById(id);
}

export async function createTemplate(
  input: CreateEmailTemplateInput,
): Promise<EmailTemplateWithDocument> {
  const type = input.type;
  const name = normalizeOptionalRequiredString(input.name, getStarterTemplateName(type));
  const subject = normalizeOptionalRequiredString(input.subject, getStarterSubject(type));
  const document = input.document ?? createStarterTemplateDocument(type);

  const created = await prisma.emailTemplate.create({
    data: {
      name,
      type,
      subject,
      preheader: normalizeNullableString(input.preheader),
      fromName: normalizeNullableString(input.fromName),
      status: "DRAFT",
      version: 0,
      blocksJson: serializeEmailTemplateDocumentForPrisma(document),
    },
    select: emailTemplateSelect,
  });

  return mapTemplateRow(created as EmailTemplatePrismaRecord);
}

export async function updateTemplate(
  id: string,
  input: UpdateEmailTemplateInput,
): Promise<EmailTemplateWithDocument> {
  await requireTemplateById(id);

  const data: {
    name?: string;
    type?: EmailTemplateType;
    subject?: string;
    preheader?: string | null;
    fromName?: string | null;
    status?: EmailTemplateStatus;
    blocksJson?: ReturnType<typeof serializeEmailTemplateDocumentForPrisma>;
  } = {};

  if (input.name !== undefined) {
    data.name = normalizeRequiredString(input.name, "Template name");
  }
  if (input.type !== undefined) {
    data.type = input.type;
  }
  if (input.subject !== undefined) {
    data.subject = normalizeRequiredString(input.subject, "Subject");
  }
  if (input.preheader !== undefined) {
    data.preheader = normalizeNullableString(input.preheader);
  }
  if (input.fromName !== undefined) {
    data.fromName = normalizeNullableString(input.fromName);
  }
  if (input.status !== undefined) {
    if (input.status === "PUBLISHED") {
      throw createEmailTemplateInvalidError(
        "Use publishTemplate() to move a template to PUBLISHED.",
      );
    }
    if (input.status === "ARCHIVED") {
      throw createEmailTemplateInvalidError(
        "Use archiveTemplate() to move a template to ARCHIVED.",
      );
    }
    data.status = input.status;
  }
  if (input.document !== undefined) {
    data.blocksJson = serializeEmailTemplateDocumentForPrisma(input.document);
  }

  const updated = await prisma.emailTemplate.update({
    where: { id },
    data,
    select: emailTemplateSelect,
  });

  return mapTemplateRow(updated as EmailTemplatePrismaRecord);
}

export async function publishTemplate(
  id: string,
  input: PublishEmailTemplateInput = {},
): Promise<PublishEmailTemplateResult> {
  const template = await requireTemplateById(id);
  assertTemplatePublishable(template);

  // Run publish guard — may block or return a warning
  const guard = validateEmailTemplatePublishRules(template.type, template.document);
  if (!guard.ok) {
    throw createEmailTemplateInvalidError(guard.message);
  }

  const nextVersion = template.version + 1;

  const existingSnapshot = await prisma.emailTemplateVersion.findUnique({
    where: {
      templateId_version: {
        templateId: id,
        version: nextVersion,
      },
    },
    select: { id: true },
  });

  if (existingSnapshot) {
    throw createEmailTemplateConflictError(
      `Template "${id}" already has a snapshot for version ${nextVersion}.`,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.emailTemplateVersion.create({
      data: {
        templateId: template.id,
        version: nextVersion,
        subject: template.subject,
        preheader: template.preheader,
        fromName: template.fromName,
        blocksJson: serializeEmailTemplateDocumentForPrisma(template.document),
        createdByUserId: input.createdByUserId ?? null,
      },
    });

    return tx.emailTemplate.update({
      where: { id },
      data: {
        version: nextVersion,
        status: "PUBLISHED",
      },
      select: emailTemplateSelect,
    });
  });

  return {
    template: mapTemplateRow(updated as EmailTemplatePrismaRecord),
    warning: guard.warning,
  };
}

export async function duplicateTemplate(id: string): Promise<EmailTemplateWithDocument> {
  const template = await requireTemplateById(id);

  const duplicated = await prisma.emailTemplate.create({
    data: {
      name: `${template.name} copy`,
      type: template.type,
      subject: template.subject,
      preheader: template.preheader,
      fromName: template.fromName,
      status: "DRAFT",
      version: 0,
      blocksJson: serializeEmailTemplateDocumentForPrisma(template.document),
    },
    select: emailTemplateSelect,
  });

  return mapTemplateRow(duplicated as EmailTemplatePrismaRecord);
}

export async function archiveTemplate(id: string): Promise<EmailTemplateWithDocument> {
  await requireTemplateById(id);

  const archived = await prisma.emailTemplate.update({
    where: { id },
    data: {
      status: "ARCHIVED",
    },
    select: emailTemplateSelect,
  });

  return mapTemplateRow(archived as EmailTemplatePrismaRecord);
}

export async function deleteTemplate(id: string): Promise<void> {
  await requireTemplateById(id);
  await prisma.emailTemplate.delete({
    where: { id },
  });
}

export { createVersionSnapshot };
