import "server-only";
import type { EmailTemplateDocument } from "@/features/email-studio/lib";
import {
  buildEmailPreviewData,
  type EmailPreviewPreset,
} from "@/features/email-studio/server/email-template-preview";
import {
  renderEmailPreheader,
  renderEmailSubject,
  renderEmailTemplateToHtml,
} from "@/features/email-studio/server/email-template-renderer";

export type RenderEmailTemplatePreviewInput = {
  subject: string;
  preheader?: string | null;
  document: EmailTemplateDocument;
  previewPreset: EmailPreviewPreset;
};

export type RenderEmailTemplatePreviewResult = {
  subject: string;
  preheader: string;
  html: string;
};

export async function renderEmailTemplatePreview(
  input: RenderEmailTemplatePreviewInput,
): Promise<RenderEmailTemplatePreviewResult> {
  const renderContext = buildEmailPreviewData(input.previewPreset);
  const subject = renderEmailSubject(input.subject, renderContext);
  const preheader = renderEmailPreheader(input.preheader, renderContext);
  const html = await renderEmailTemplateToHtml(input.document, renderContext, {
    preheader: input.preheader,
  });

  return {
    subject,
    preheader,
    html,
  };
}
