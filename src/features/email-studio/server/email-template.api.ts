import { z } from "zod";
import {
  EmailTemplateDocumentSchema,
  EmailTemplateStatusSchema,
  EmailTemplateTypeSchema,
} from "@/features/email-studio/lib";

export const EmailPreviewPresetSchema = z.enum([
  "new-user",
  "user-with-child",
  "plan-reminder",
  "empty-state",
]);

export const EmailTemplateRenderContextSchema = z.object({
  user: z.object({
    firstName: z.string().nullable().optional(),
    fullName: z.string().nullable().optional(),
  }),
  city: z.object({
    name: z.string().nullable().optional(),
  }),
  links: z.object({
    homeUrl: z.string().nullable().optional(),
    verifyEmailUrl: z.string().nullable().optional(),
    resetPasswordUrl: z.string().nullable().optional(),
    unsubscribeUrl: z.string().nullable().optional(),
  }),
  plan: z.object({
    date: z.string().nullable().optional(),
  }),
  brand: z.object({
    name: z.string().nullable().optional(),
    supportEmail: z.string().nullable().optional(),
  }),
});

export const CreateEmailTemplateBodySchema = z.object({
  name: z.string().optional(),
  type: EmailTemplateTypeSchema,
  subject: z.string().optional(),
  preheader: z.string().nullable().optional(),
  fromName: z.string().nullable().optional(),
  document: EmailTemplateDocumentSchema.optional(),
}).strict();

export const UpdateEmailTemplateBodySchema = z
  .object({
    name: z.string().optional(),
    type: EmailTemplateTypeSchema.optional(),
    subject: z.string().optional(),
    preheader: z.string().nullable().optional(),
    fromName: z.string().nullable().optional(),
    status: EmailTemplateStatusSchema.optional(),
    document: EmailTemplateDocumentSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export const PublishEmailTemplateBodySchema = z.object({}).strict();

export const DuplicateEmailTemplateBodySchema = z.object({}).strict();

export const TestSendEmailTemplateBodySchema = z
  .object({
    email: z.string().email(),
    previewPreset: EmailPreviewPresetSchema.optional(),
    renderContext: EmailTemplateRenderContextSchema.optional(),
  })
  .strict();

export const PreviewEmailTemplateBodySchema = z
  .object({
    subject: z.string(),
    preheader: z.string().nullable().optional(),
    document: EmailTemplateDocumentSchema,
    previewPreset: EmailPreviewPresetSchema,
  })
  .strict();

export type CreateEmailTemplateBody = z.infer<typeof CreateEmailTemplateBodySchema>;
export type UpdateEmailTemplateBody = z.infer<typeof UpdateEmailTemplateBodySchema>;
export type TestSendEmailTemplateBody = z.infer<typeof TestSendEmailTemplateBodySchema>;
export type PreviewEmailTemplateBody = z.infer<typeof PreviewEmailTemplateBodySchema>;
