import { z } from "zod";

export const EMAIL_TEMPLATE_DOCUMENT_SCHEMA_VERSION = 1 as const;

/**
 * Email template types.
 *
 * DOMAIN RULE: Marketing vs Transactional
 *
 * Transactional (always sent, ignore User.marketingEmailsEnabled):
 *   - VERIFY_EMAIL     — account verification
 *   - RESET_PASSWORD   — password recovery
 *   - WELCOME          — onboarding trigger at registration (not recurring marketing)
 *
 * Marketing (respect User.marketingEmailsEnabled):
 *   - WEEKLY_DIGEST    — recurring editorial content
 *   - PROMO_CAMPAIGN   — promotional campaigns
 *   - PLAN_REMINDER    — recurring engagement nudge
 *   - CUSTOM           — unknown intent, treated as marketing by default
 *
 * See: src/features/email-studio/server/email-sending-rules.ts
 */
export const EmailTemplateTypeSchema = z.enum([
  "WELCOME",
  "VERIFY_EMAIL",
  "RESET_PASSWORD",
  "PLAN_REMINDER",
  "WEEKLY_DIGEST",
  "PROMO_CAMPAIGN",
  "CUSTOM",
]);
export type EmailTemplateType = z.infer<typeof EmailTemplateTypeSchema>;

export const EmailTemplateStatusSchema = z.enum([
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);
export type EmailTemplateStatus = z.infer<typeof EmailTemplateStatusSchema>;

export const EmailBlockTypeSchema = z.enum([
  "header",
  "hero",
  "text",
  "cta",
  "spacer",
  "divider",
  "footer",
]);
export type EmailBlockType = z.infer<typeof EmailBlockTypeSchema>;

const EmailBlockBaseSchema = z.object({
  id: z.string().min(1),
});

export const EmailHeaderBlockSchema = EmailBlockBaseSchema.extend({
  type: z.literal("header"),
  brandText: z.string(),
  brandHref: z.string(),
  logoUrl: z.string().optional(),
}).strict();

export const EmailHeroAlignSchema = z.enum(["left", "center"]);
export type EmailHeroAlign = z.infer<typeof EmailHeroAlignSchema>;

export const EmailHeroBlockSchema = EmailBlockBaseSchema.extend({
  type: z.literal("hero"),
  title: z.string(),
  text: z.string(),
  buttonLabel: z.string(),
  buttonUrl: z.string(),
  imageUrl: z.string().optional(),
  align: EmailHeroAlignSchema,
}).strict();

export const EmailTextBlockSchema = EmailBlockBaseSchema.extend({
  type: z.literal("text"),
  content: z.string(),
}).strict();

export const EmailCtaBlockSchema = EmailBlockBaseSchema.extend({
  type: z.literal("cta"),
  title: z.string(),
  text: z.string(),
  buttonLabel: z.string(),
  buttonUrl: z.string(),
}).strict();

export const EmailSpacerSizeSchema = z.enum(["xs", "sm", "md", "lg", "xl"]);
export type EmailSpacerSize = z.infer<typeof EmailSpacerSizeSchema>;

export const EmailSpacerBlockSchema = EmailBlockBaseSchema.extend({
  type: z.literal("spacer"),
  size: EmailSpacerSizeSchema,
}).strict();

export const EmailDividerBlockSchema = EmailBlockBaseSchema.extend({
  type: z.literal("divider"),
}).strict();

export const EmailFooterBlockSchema = EmailBlockBaseSchema.extend({
  type: z.literal("footer"),
  supportEmail: z.string().optional(),
  showUnsubscribe: z.boolean(),
}).strict();

export const EmailBlockSchema = z.discriminatedUnion("type", [
  EmailHeaderBlockSchema,
  EmailHeroBlockSchema,
  EmailTextBlockSchema,
  EmailCtaBlockSchema,
  EmailSpacerBlockSchema,
  EmailDividerBlockSchema,
  EmailFooterBlockSchema,
]);
export type EmailBlock = z.infer<typeof EmailBlockSchema>;

export const EmailTemplateDocumentSchema = z.object({
  schemaVersion: z.literal(EMAIL_TEMPLATE_DOCUMENT_SCHEMA_VERSION),
  blocks: z.array(EmailBlockSchema),
}).strict();
export type EmailTemplateDocument = z.infer<typeof EmailTemplateDocumentSchema>;

type BlockIdFactory = () => string;

function defaultBlockIdFactory(): string {
  return crypto.randomUUID();
}

export function createEmailBlockId(idFactory: BlockIdFactory = defaultBlockIdFactory): string {
  return idFactory();
}

export function createDefaultEmailBlock(
  type: EmailBlockType,
  idFactory: BlockIdFactory = defaultBlockIdFactory,
): EmailBlock {
  const id = createEmailBlockId(idFactory);

  switch (type) {
    case "header":
      return {
        id,
        type,
        brandText: "mamaGo",
        brandHref: "{{links.homeUrl}}",
        logoUrl: "",
      };
    case "hero":
      return {
        id,
        type,
        title: "",
        text: "",
        buttonLabel: "Open",
        buttonUrl: "{{links.homeUrl}}",
        imageUrl: "",
        align: "left",
      };
    case "text":
      return {
        id,
        type,
        content: "",
      };
    case "cta":
      return {
        id,
        type,
        title: "",
        text: "",
        buttonLabel: "Open",
        buttonUrl: "{{links.homeUrl}}",
      };
    case "spacer":
      return {
        id,
        type,
        size: "md",
      };
    case "divider":
      return {
        id,
        type,
      };
    case "footer":
      return {
        id,
        type,
        showUnsubscribe: false,
      };
    default: {
      const neverType: never = type;
      return neverType;
    }
  }
}

export function createEmptyTemplateDocument(): EmailTemplateDocument {
  return {
    schemaVersion: EMAIL_TEMPLATE_DOCUMENT_SCHEMA_VERSION,
    blocks: [],
  };
}

function createStarterBlocksByType(
  templateType: EmailTemplateType,
  idFactory: BlockIdFactory = defaultBlockIdFactory,
): EmailBlock[] {
  switch (templateType) {
    case "WELCOME":
      return [
        createDefaultEmailBlock("header", idFactory),
        {
          ...createDefaultEmailBlock("hero", idFactory),
          title: "Welcome to mamaGo",
          text: "Find ideas, plan your days, and make family time calmer.",
          buttonLabel: "Build your first plan",
          buttonUrl: "{{links.homeUrl}}",
        },
        {
          ...createDefaultEmailBlock("text", idFactory),
          content: "Add 2–3 ideas, build a weekend plan, and simply follow it.",
        },
        createDefaultEmailBlock("footer", idFactory),
      ];
    case "VERIFY_EMAIL":
      return [
        createDefaultEmailBlock("header", idFactory),
        {
          ...createDefaultEmailBlock("hero", idFactory),
          title: "Verify your email",
          text: "Confirm your email address to keep using mamaGo without limits.",
          buttonLabel: "Verify email",
          buttonUrl: "{{links.verifyEmailUrl}}",
        },
        createDefaultEmailBlock("footer", idFactory),
      ];
    case "RESET_PASSWORD":
      return [
        createDefaultEmailBlock("header", idFactory),
        {
          ...createDefaultEmailBlock("hero", idFactory),
          title: "Reset your password",
          text: "Use the button below to create a new password for your account.",
          buttonLabel: "Reset password",
          buttonUrl: "{{links.resetPasswordUrl}}",
        },
        createDefaultEmailBlock("footer", idFactory),
      ];
    case "PLAN_REMINDER":
      return [
        createDefaultEmailBlock("header", idFactory),
        {
          ...createDefaultEmailBlock("text", idFactory),
          content: "You have a family plan coming up on {{plan.date}}.",
        },
        {
          ...createDefaultEmailBlock("cta", idFactory),
          title: "Review your plan",
          text: "Open the plan and make sure everything is ready.",
          buttonLabel: "Open plan",
          buttonUrl: "{{links.homeUrl}}",
        },
        createDefaultEmailBlock("footer", idFactory),
      ];
    case "WEEKLY_DIGEST":
      return [
        createDefaultEmailBlock("header", idFactory),
        {
          ...createDefaultEmailBlock("hero", idFactory),
          title: "Ideas for your week",
          text: "Fresh family-friendly picks collected for you.",
          buttonLabel: "See ideas",
          buttonUrl: "{{links.homeUrl}}",
        },
        createDefaultEmailBlock("footer", idFactory),
      ];
    case "PROMO_CAMPAIGN":
      return [
        createDefaultEmailBlock("header", idFactory),
        {
          ...createDefaultEmailBlock("hero", idFactory),
          title: "A special update from mamaGo",
          text: "Discover something new for your next family outing.",
          buttonLabel: "Explore",
          buttonUrl: "{{links.homeUrl}}",
        },
        createDefaultEmailBlock("footer", idFactory),
      ];
    case "CUSTOM":
      return [
        createDefaultEmailBlock("header", idFactory),
        createDefaultEmailBlock("text", idFactory),
        createDefaultEmailBlock("footer", idFactory),
      ];
    default: {
      const neverType: never = templateType;
      return neverType;
    }
  }
}

export function createStarterTemplateDocument(
  templateType: EmailTemplateType,
  idFactory: BlockIdFactory = defaultBlockIdFactory,
): EmailTemplateDocument {
  return {
    schemaVersion: EMAIL_TEMPLATE_DOCUMENT_SCHEMA_VERSION,
    blocks: createStarterBlocksByType(templateType, idFactory),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? value : undefined;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeHeaderBlock(raw: Record<string, unknown>, idFactory: BlockIdFactory): EmailBlock {
  return {
    id: normalizeString(raw.id, createEmailBlockId(idFactory)),
    type: "header",
    brandText: normalizeString(raw.brandText),
    brandHref: normalizeString(raw.brandHref),
    logoUrl: normalizeString(raw.logoUrl),
  };
}

function normalizeHeroBlock(raw: Record<string, unknown>, idFactory: BlockIdFactory): EmailBlock {
  return {
    id: normalizeString(raw.id, createEmailBlockId(idFactory)),
    type: "hero",
    title: normalizeString(raw.title),
    text: normalizeString(raw.text),
    buttonLabel: normalizeString(raw.buttonLabel),
    buttonUrl: normalizeString(raw.buttonUrl),
    imageUrl: normalizeString(raw.imageUrl),
    align: raw.align === "center" ? "center" : "left",
  };
}

function normalizeTextBlock(raw: Record<string, unknown>, idFactory: BlockIdFactory): EmailBlock {
  return {
    id: normalizeString(raw.id, createEmailBlockId(idFactory)),
    type: "text",
    content: normalizeString(raw.content),
  };
}

function normalizeCtaBlock(raw: Record<string, unknown>, idFactory: BlockIdFactory): EmailBlock {
  return {
    id: normalizeString(raw.id, createEmailBlockId(idFactory)),
    type: "cta",
    title: normalizeString(raw.title),
    text: normalizeString(raw.text),
    buttonLabel: normalizeString(raw.buttonLabel),
    buttonUrl: normalizeString(raw.buttonUrl),
  };
}

function normalizeSpacerBlock(raw: Record<string, unknown>, idFactory: BlockIdFactory): EmailBlock {
  const size = raw.size;
  return {
    id: normalizeString(raw.id, createEmailBlockId(idFactory)),
    type: "spacer",
    size:
      size === "xs" || size === "sm" || size === "md" || size === "lg" || size === "xl"
        ? size
        : "md",
  };
}

function normalizeDividerBlock(raw: Record<string, unknown>, idFactory: BlockIdFactory): EmailBlock {
  return {
    id: normalizeString(raw.id, createEmailBlockId(idFactory)),
    type: "divider",
  };
}

function normalizeFooterBlock(raw: Record<string, unknown>, idFactory: BlockIdFactory): EmailBlock {
  return {
    id: normalizeString(raw.id, createEmailBlockId(idFactory)),
    type: "footer",
    supportEmail: normalizeOptionalString(raw.supportEmail),
    showUnsubscribe: normalizeBoolean(raw.showUnsubscribe),
  };
}

function normalizeBlock(raw: unknown, idFactory: BlockIdFactory): EmailBlock | null {
  if (!isRecord(raw)) return null;

  switch (raw.type) {
    case "header":
      return normalizeHeaderBlock(raw, idFactory);
    case "hero":
      return normalizeHeroBlock(raw, idFactory);
    case "text":
      return normalizeTextBlock(raw, idFactory);
    case "cta":
      return normalizeCtaBlock(raw, idFactory);
    case "spacer":
      return normalizeSpacerBlock(raw, idFactory);
    case "divider":
      return normalizeDividerBlock(raw, idFactory);
    case "footer":
      return normalizeFooterBlock(raw, idFactory);
    default:
      return null;
  }
}

export function normalizeTemplateDocument(
  raw: unknown,
  idFactory: BlockIdFactory = defaultBlockIdFactory,
): EmailTemplateDocument {
  if (!isRecord(raw)) {
    return createEmptyTemplateDocument();
  }

  const schemaVersion =
    raw.schemaVersion === EMAIL_TEMPLATE_DOCUMENT_SCHEMA_VERSION ||
    raw.version === EMAIL_TEMPLATE_DOCUMENT_SCHEMA_VERSION
      ? EMAIL_TEMPLATE_DOCUMENT_SCHEMA_VERSION
      : EMAIL_TEMPLATE_DOCUMENT_SCHEMA_VERSION;

  const rawBlocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const blocks = rawBlocks
    .map((block) => normalizeBlock(block, idFactory))
    .filter((block): block is EmailBlock => block !== null);

  return {
    schemaVersion,
    blocks,
  };
}

export function assertTemplateDocumentValid(raw: unknown): EmailTemplateDocument {
  return EmailTemplateDocumentSchema.parse(raw);
}
