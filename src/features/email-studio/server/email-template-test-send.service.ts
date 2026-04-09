import "server-only";
import { getResendClient } from "@/features/email/server/resend-client";
import { getTemplateById } from "@/features/email-studio/server/email-template.service";
import {
  buildEmailPreviewData,
  type EmailPreviewPreset,
  type EmailTemplateRenderContext,
} from "@/features/email-studio/server/email-template-preview";
import {
  renderEmailPreheader,
  renderEmailSubject,
  renderEmailTemplateToHtml,
} from "@/features/email-studio/server/email-template-renderer";
import {
  EmailTemplateServiceError,
  createEmailTemplateDeliveryUnavailableError,
  createEmailTemplateSendFailedError,
} from "@/features/email-studio/server/email-template.errors";

export type SendTestEmailInput = {
  templateId: string;
  to: string;
  previewPreset?: EmailPreviewPreset;
  renderContext?: EmailTemplateRenderContext;
};

export type SendTestEmailResult = {
  success: true;
  intendedTo: string;
  actualTo: string;
  subject: string;
  preheader: string;
  messageId: string | null;
};

function isEmailEnabled(): boolean {
  return process.env.EMAIL_ENABLED === "true";
}

function getFrom(): string {
  const from = process.env.EMAIL_FROM?.trim();
  if (!from) {
    throw createEmailTemplateDeliveryUnavailableError(
      "EMAIL_FROM is required for test send.",
    );
  }
  return from;
}

function getReplyTo(): string {
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  if (!replyTo) {
    throw createEmailTemplateDeliveryUnavailableError(
      "EMAIL_REPLY_TO is required for test send.",
    );
  }
  return replyTo;
}

function getActualRecipient(intendedTo: string): string {
  return process.env.EMAIL_DEBUG_REDIRECT_TO?.trim() || intendedTo;
}

export async function sendTestEmail(
  input: SendTestEmailInput,
): Promise<SendTestEmailResult> {
  if (!isEmailEnabled()) {
    throw createEmailTemplateDeliveryUnavailableError(
      "EMAIL_ENABLED=true is required to send test emails.",
    );
  }

  const template = await getTemplateById(input.templateId);
  const renderContext =
    input.renderContext ?? buildEmailPreviewData(input.previewPreset ?? "new-user");
  const subject = renderEmailSubject(template.subject, renderContext);
  const preheader = renderEmailPreheader(template.preheader, renderContext);
  const html = await renderEmailTemplateToHtml(template.document, renderContext, {
    preheader: template.preheader,
  });

  try {
    const resend = getResendClient();
    const actualTo = getActualRecipient(input.to);
    const { data, error } = await resend.emails.send({
      from: getFrom(),
      to: [actualTo],
      replyTo: [getReplyTo()],
      subject,
      html,
      tags: [{ name: "type", value: "email-studio-test" }],
    });

    if (error) {
      throw createEmailTemplateSendFailedError(error.message);
    }

    return {
      success: true,
      intendedTo: input.to,
      actualTo,
      subject,
      preheader,
      messageId: data?.id ?? null,
    };
  } catch (error) {
    if (error instanceof EmailTemplateServiceError) {
      throw error;
    }

    throw createEmailTemplateSendFailedError(
      error instanceof Error ? error.message : "Failed to send test email.",
    );
  }
}
