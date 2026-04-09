import "server-only";
import type { ReactNode } from "react";
import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";
import {
  assertTemplateDocumentValid,
  normalizeTemplateDocument,
  type EmailBlock,
  type EmailTemplateDocument,
} from "@/features/email-studio/lib";
import type {
  EmailPreviewPreset,
  EmailTemplateRenderContext,
} from "@/features/email-studio/server/email-template-preview";
import { buildEmailPreviewData } from "@/features/email-studio/server/email-template-preview";
import { EmailFooterBlock } from "@/features/email-studio/server/components/EmailFooterBlock";

export type { EmailPreviewPreset, EmailTemplateRenderContext };

export type EmailTemplateRenderOptions = {
  preheader?: string | null;
};

type RenderableValue = string | null | undefined | Record<string, unknown>;

const BODY_STYLE = {
  margin: "0",
  padding: "32px 16px",
  backgroundColor: "#f8f7f5",
  fontFamily:
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
  color: "#1f2937",
} as const;

const CARD_STYLE = {
  margin: "0 auto",
  maxWidth: "600px",
  backgroundColor: "#ffffff",
  borderRadius: "20px",
  padding: "32px",
} as const;

const TEXT_STYLE = {
  margin: "0 0 16px",
  fontSize: "16px",
  lineHeight: "24px",
  color: "#374151",
} as const;

const MUTED_TEXT_STYLE = {
  margin: "0",
  fontSize: "13px",
  lineHeight: "20px",
  color: "#6b7280",
} as const;

const CTA_BUTTON_STYLE = {
  display: "inline-block",
  backgroundColor: "#EF8759",
  borderRadius: "12px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  lineHeight: "15px",
  padding: "14px 22px",
  textDecoration: "none",
} as const;

const DIVIDER_STYLE = {
  borderColor: "#ebe5df",
  margin: "24px 0",
} as const;

function getFallbackHomeUrl(context: EmailTemplateRenderContext): string {
  return (
    context.links.homeUrl?.trim() ||
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://mamago.by"
  );
}

function getFallbackSupportEmail(
  block: Pick<Extract<EmailBlock, { type: "footer" }>, "supportEmail">,
  context: EmailTemplateRenderContext,
): string {
  return (
    block.supportEmail?.trim() ||
    context.brand.supportEmail?.trim() ||
    process.env.EMAIL_REPLY_TO?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "support@mamago.by"
  );
}

function getRenderableScalar(value: RenderableValue): string {
  return typeof value === "string" ? value : "";
}

function getValueByPath(context: EmailTemplateRenderContext, path: string): string {
  const keys = path.split(".");
  let current: RenderableValue = context as unknown as Record<string, unknown>;

  for (const key of keys) {
    if (!current || typeof current !== "object") {
      return "";
    }
    current = (current as Record<string, unknown>)[key] as RenderableValue;
  }

  return getRenderableScalar(current);
}

export function renderEmailTextTokens(
  value: string | null | undefined,
  context: EmailTemplateRenderContext,
): string {
  if (!value) return "";

  return value
    .replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path: string) => getValueByPath(context, path))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Renders formatted text with support for:
 * - Line breaks (converts \n to <br />)
 * - Bold text (**text** or __text__)
 * - Preserves whitespace
 */
export function renderFormattedEmailText(
  value: string | null | undefined,
  context: EmailTemplateRenderContext,
  style?: React.CSSProperties,
): React.ReactNode {
  const processedText = renderEmailTextTokens(value, context);
  if (!processedText) return null;

  // Split by lines first
  const lines = processedText.split("\n");
  
  return (
    <Text style={style}>
      {lines.map((line, lineIndex) => {
        if (!line.trim()) {
          // Empty line - render as spacing
          return <React.Fragment key={lineIndex}><br /></React.Fragment>;
        }

        // Process bold formatting within the line
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        
        // Match **text** or __text__
        const boldRegex = /(\*\*|__)(.*?)\1/g;
        let match;
        
        while ((match = boldRegex.exec(line)) !== null) {
          // Add text before the bold part
          if (match.index > lastIndex) {
            parts.push(line.substring(lastIndex, match.index));
          }
          
          // Add bold text
          parts.push(
            <strong key={`bold-${lineIndex}-${match.index}`}>
              {match[2]}
            </strong>
          );
          
          lastIndex = match.index + match[0].length;
        }
        
        // Add remaining text
        if (lastIndex < line.length) {
          parts.push(line.substring(lastIndex));
        }
        
        return (
          <React.Fragment key={lineIndex}>
            {parts.length > 0 ? parts : line}
            {lineIndex < lines.length - 1 && <br />}
          </React.Fragment>
        );
      })}
    </Text>
  );
}

export function renderEmailSubject(
  subject: string | null | undefined,
  context: EmailTemplateRenderContext,
): string {
  return renderEmailTextTokens(subject, context);
}

export function renderEmailPreheader(
  preheader: string | null | undefined,
  context: EmailTemplateRenderContext,
): string {
  return renderEmailTextTokens(preheader, context);
}

export function renderHeaderBlock(
  block: Extract<EmailBlock, { type: "header" }>,
  context: EmailTemplateRenderContext,
): React.ReactNode {
  const brandText = renderEmailTextTokens(block.brandText, context) || context.brand.name || "mamaGo";
  const brandHref = renderEmailTextTokens(block.brandHref, context) || getFallbackHomeUrl(context);
  const logoUrl = renderEmailTextTokens(block.logoUrl, context);

  return (
    <Section key={block.id} style={{ margin: "0 0 24px" }}>
      {logoUrl ? (
        <a href={brandHref} style={{ textDecoration: "none" }}>
          <Img src={logoUrl} alt={brandText} width="120" />
        </a>
      ) : (
        <Text
          style={{
            margin: "0",
            fontSize: "18px",
            lineHeight: "22px",
            fontWeight: "700",
            color: "#111827",
          }}
        >
          <a href={brandHref} style={{ color: "#111827", textDecoration: "none" }}>
            {brandText}
          </a>
        </Text>
      )}
    </Section>
  );
}

export function renderHeroBlock(
  block: Extract<EmailBlock, { type: "hero" }>,
  context: EmailTemplateRenderContext,
): React.ReactNode {
  const title = renderEmailTextTokens(block.title, context);
  const buttonLabel = renderEmailTextTokens(block.buttonLabel, context);
  const buttonUrl = renderEmailTextTokens(block.buttonUrl, context) || getFallbackHomeUrl(context);
  const imageUrl = renderEmailTextTokens(block.imageUrl, context);
  const textAlign = block.align === "center" ? "center" : "left";

  return (
    <Section key={block.id} style={{ margin: "0 0 24px", textAlign }}>
      {title ? (
        <Text
          style={{
            margin: "0 0 12px",
            fontSize: "28px",
            lineHeight: "36px",
            fontWeight: "700",
            color: "#111827",
          }}
        >
          {title}
        </Text>
      ) : null}
      {renderFormattedEmailText(block.text, context, TEXT_STYLE)}
      {imageUrl ? (
        <Section style={{ margin: "0 0 20px" }}>
          <Img
            src={imageUrl}
            alt={title || "Email image"}
            width="536"
            style={{ borderRadius: "16px", width: "100%", height: "auto" }}
          />
        </Section>
      ) : null}
      {buttonLabel ? (
        <Section style={{ margin: block.text ? "4px 0 0" : "0" }}>
          <Button href={buttonUrl} style={CTA_BUTTON_STYLE}>
            {buttonLabel}
          </Button>
        </Section>
      ) : null}
    </Section>
  );
}

export function renderTextBlock(
  block: Extract<EmailBlock, { type: "text" }>,
  context: EmailTemplateRenderContext,
): React.ReactNode {
  return (
    <Section key={block.id} style={{ margin: "0 0 20px" }}>
      {renderFormattedEmailText(block.content, context, TEXT_STYLE)}
    </Section>
  );
}

export function renderCtaBlock(
  block: Extract<EmailBlock, { type: "cta" }>,
  context: EmailTemplateRenderContext,
): React.ReactNode {
  const title = renderEmailTextTokens(block.title, context);
  const buttonLabel = renderEmailTextTokens(block.buttonLabel, context);
  const buttonUrl = renderEmailTextTokens(block.buttonUrl, context) || getFallbackHomeUrl(context);

  return (
    <Section
      key={block.id}
      style={{
        margin: "0 0 24px",
        padding: "24px",
        borderRadius: "16px",
        backgroundColor: "#fbf1eb",
      }}
    >
      {title ? (
        <Text
          style={{
            margin: "0 0 8px",
            fontSize: "20px",
            lineHeight: "28px",
            fontWeight: "700",
            color: "#111827",
          }}
        >
          {title}
        </Text>
      ) : null}
      {renderFormattedEmailText(block.text, context, TEXT_STYLE)}
      {buttonLabel ? (
        <Section style={{ margin: "4px 0 0" }}>
          <Button href={buttonUrl} style={CTA_BUTTON_STYLE}>
            {buttonLabel}
          </Button>
        </Section>
      ) : null}
    </Section>
  );
}

export function renderSpacerBlock(
  block: Extract<EmailBlock, { type: "spacer" }>,
): React.ReactNode {
  const heightBySize = {
    xs: "8px",
    sm: "12px",
    md: "20px",
    lg: "28px",
    xl: "40px",
  } as const;

  return (
    <Section key={block.id} style={{ height: heightBySize[block.size], lineHeight: heightBySize[block.size] }}>
      &nbsp;
    </Section>
  );
}

export function renderDividerBlock(
  block: Extract<EmailBlock, { type: "divider" }>,
): React.ReactNode {
  return <Hr key={block.id} style={DIVIDER_STYLE} />;
}

export function renderFooterBlock(
  block: Extract<EmailBlock, { type: "footer" }>,
  context: EmailTemplateRenderContext,
): React.ReactNode {
  const homeUrl = getFallbackHomeUrl(context);
  const supportEmail = getFallbackSupportEmail(block, context);
  
  // Only show unsubscribe if block.showUnsubscribe is true
  const unsubscribeUrl = block.showUnsubscribe
    ? renderEmailTextTokens(context.links.unsubscribeUrl, context) || null
    : null;

  return (
    <EmailFooterBlock
      key={block.id}
      homeUrl={homeUrl}
      unsubscribeUrl={unsubscribeUrl}
      supportEmail={supportEmail}
    />
  );
}

function renderBlock(
  block: EmailBlock,
  context: EmailTemplateRenderContext,
): ReactNode {
  switch (block.type) {
    case "header":
      return renderHeaderBlock(block, context);
    case "hero":
      return renderHeroBlock(block, context);
    case "text":
      return renderTextBlock(block, context);
    case "cta":
      return renderCtaBlock(block, context);
    case "spacer":
      return renderSpacerBlock(block);
    case "divider":
      return renderDividerBlock(block);
    case "footer":
      return renderFooterBlock(block, context);
    default: {
      const neverBlock: never = block;
      return neverBlock;
    }
  }
}

export function renderEmailTemplateToReact(
  document: EmailTemplateDocument,
  renderContext: EmailTemplateRenderContext,
  options: EmailTemplateRenderOptions = {},
): React.ReactElement {
  const normalizedDocument = normalizeTemplateDocument(document);
  const validatedDocument = assertTemplateDocumentValid(normalizedDocument);
  const preheader = renderEmailPreheader(options.preheader, renderContext);

  return (
    <Html>
      <Head />
      {preheader ? <Preview>{preheader}</Preview> : null}
      <Body style={BODY_STYLE}>
        <Container style={CARD_STYLE}>
          {validatedDocument.blocks.map((block) => renderBlock(block, renderContext))}
        </Container>
      </Body>
    </Html>
  );
}

export async function renderEmailTemplateToHtml(
  document: EmailTemplateDocument,
  renderContext: EmailTemplateRenderContext,
  options: EmailTemplateRenderOptions = {},
): Promise<string> {
  const reactTree = renderEmailTemplateToReact(document, renderContext, options);
  return render(reactTree);
}

export function buildRenderContextFromPreset(
  preset: EmailPreviewPreset,
): EmailTemplateRenderContext {
  return buildEmailPreviewData(preset);
}
