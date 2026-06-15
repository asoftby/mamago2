/**
 * Чистое ядро рендера шаблонов уведомлений (без server-only/БД — тестируется tsx-скриптом).
 *
 * Контракт:
 * - интерполяция только {{var}}, никакого eval/new Function;
 * - переменная не из allowedVars → TemplateRenderError (вызывающий делает fallback);
 * - переменная из allowedVars, но отсутствующая в payload (optional) → пустая строка;
 * - EMAIL/TELEGRAM: значения переменных HTML-эскейпятся, теги разрешены только
 *   из тела самого шаблона и проходят канальную санитизацию;
 * - EMAIL subject — plain text, переменные не эскейпятся;
 * - IN_APP: финальный результат приводится к plain text и обрезается.
 *
 * Санитизация: EMAIL — общий проектный allowlist-санитайзер sanitizeHtmlAllowlist
 * (тот же путь, что для Tiptap/article-контента; SSR-safe, без DOMPurify/jsdom);
 * TELEGRAM — собственный балансирующий санитайзер под HTML-сабсет Telegram.
 */

import { sanitizeHtmlAllowlist } from "@/lib/article/articleBlockHtml";

export type TemplateRenderChannel = "IN_APP" | "EMAIL" | "TELEGRAM";

export const IN_APP_BODY_MAX_LENGTH = 1000;
export const IN_APP_SUBJECT_MAX_LENGTH = 200;

const TEMPLATE_VAR_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export class TemplateRenderError extends Error {
  constructor(
    message: string,
    public readonly unknownVariables: string[] = [],
  ) {
    super(message);
    this.name = "TemplateRenderError";
  }
}

export function extractTemplateVariables(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(TEMPLATE_VAR_RE)) {
    found.add(match[1]);
  }
  return [...found];
}

/**
 * Валидация шаблона при сохранении: все {{...}} должны быть из allowedVariables.
 */
export function validateTemplateVariables(
  template: string,
  allowedVariables: string[],
): { ok: true } | { ok: false; unknownVariables: string[] } {
  const allowed = new Set(allowedVariables);
  const unknown = extractTemplateVariables(template).filter((name) => !allowed.has(name));
  return unknown.length === 0 ? { ok: true } : { ok: false, unknownVariables: unknown };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function interpolateTemplate(args: {
  template: string;
  payload: Record<string, string>;
  allowedVariables: string[];
  escapeVariable?: (value: string) => string;
}): string {
  const allowed = new Set(args.allowedVariables);
  const escape = args.escapeVariable ?? ((value: string) => value);
  const unknown: string[] = [];

  const result = args.template.replace(TEMPLATE_VAR_RE, (_match, name: string) => {
    if (!allowed.has(name)) {
      unknown.push(name);
      return "";
    }
    const value = args.payload[name];
    return value === undefined ? "" : escape(value);
  });

  if (unknown.length > 0) {
    throw new TemplateRenderError(
      `Unknown template variables: ${[...new Set(unknown)].join(", ")}`,
      [...new Set(unknown)],
    );
  }

  return result;
}

// ─── Канальная санитизация ────────────────────────────────────────────────────

/** Разрешённый Telegram HTML-сабсет (https://core.telegram.org/bots/api#html-style). */
const TELEGRAM_ALLOWED_TAGS = new Set([
  "b", "strong", "i", "em", "u", "ins", "s", "strike", "del",
  "span", "tg-spoiler", "a", "code", "pre", "blockquote",
]);

/**
 * Оставляет только разрешённый Telegram-сабсет тегов; запрещённые теги удаляются
 * (текст внутри сохраняется). Атрибуты вычищаются, кроме href у <a>
 * (только http/https/tg) и class="tg-spoiler" у <span>.
 *
 * Полная балансировка — Telegram отклоняет любое сообщение с несбалансированным
 * HTML, поэтому на выходе гарантируется корректная вложенность:
 * - выброшенный открывающий (плохой href, span без tg-spoiler) → парный
 *   закрывающий тоже выбрасывается;
 * - висячий закрывающий без открытого парного → выбрасывается;
 * - висячий открывающий, не закрытый в тексте, → автозакрывается в конце.
 *
 * Идемпотентна: повторный прогон уже очищенного HTML ничего не меняет.
 */
export function sanitizeTelegramHtml(html: string): string {
  /** стек открытых (оставленных) тегов в порядке открытия — для LIFO-закрытия */
  const openStack: string[] = [];
  const out: string[] = [];

  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s[^<>]*)?)\/?>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(html)) !== null) {
    out.push(html.slice(lastIndex, match.index));
    lastIndex = tagRe.lastIndex;

    const full = match[0];
    const tag = match[1].toLowerCase();
    const rawAttrs = match[2] ?? "";

    if (!TELEGRAM_ALLOWED_TAGS.has(tag)) continue;

    if (full.startsWith("</")) {
      const top = openStack[openStack.length - 1];
      if (top === tag) {
        openStack.pop();
        out.push(`</${tag}>`);
      }
      // несоответствующий/висячий закрывающий — выбрасываем
      continue;
    }

    let rendered: string | null;
    if (tag === "a") {
      const hrefMatch = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(rawAttrs);
      const href = hrefMatch?.[1] ?? hrefMatch?.[2] ?? "";
      rendered = /^(https?:\/\/|tg:\/\/)/i.test(href) ? `<a href="${href}">` : null;
    } else if (tag === "span") {
      rendered = /class\s*=\s*["']tg-spoiler["']/i.test(rawAttrs)
        ? `<span class="tg-spoiler">`
        : null;
    } else {
      rendered = `<${tag}>`;
    }

    if (rendered === null) continue;

    out.push(rendered);
    // self-closing (<br/>-стиль) не участвует в балансировке
    if (!full.endsWith("/>")) openStack.push(tag);
  }

  out.push(html.slice(lastIndex));

  // автозакрытие висячих открытых тегов в обратном порядке
  while (openStack.length > 0) {
    out.push(`</${openStack.pop()}>`);
  }

  return out.join("");
}

/**
 * Разрешённый HTML-сабсет для email-тела override-шаблонов.
 * Санитизация делегируется общему проектному sanitizeHtmlAllowlist
 * (вырезает script/style целиком, режет on*-атрибуты и опасные протоколы).
 */
const EMAIL_ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s",
  "ul", "ol", "li", "a", "h2", "h3", "h4", "blockquote", "span", "div",
];
const EMAIL_ALLOWED_ATTRS = ["href", "target", "rel"];

export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtmlAllowlist(html, EMAIL_ALLOWED_TAGS, EMAIL_ALLOWED_ATTRS);
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Обрезка по длине с многоточием, без изменения содержимого. */
export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/** Plain text для in-app: убрать теги, декодировать базовые entity, обрезать. */
export function toPlainText(value: string, maxLength: number): string {
  return truncateText(decodeBasicEntities(value.replace(/<[^>]*>/g, "")), maxLength);
}

// ─── Канальный рендер ─────────────────────────────────────────────────────────

export type RenderedTemplateContent = {
  subject: string | null;
  body: string;
};

export type TemplateDefaultLike =
  | { kind: "template"; subject: string | null; body: string }
  | { kind: "code"; note: string };

export type RenderedWithSource = RenderedTemplateContent & {
  source: "OVERRIDE" | "DEFAULT";
};

/**
 * Каскад «override из БД → дефолт из кода»: упавший override логируется
 * через onOverrideError и не ломает отправку; kind:"code" или отсутствие
 * дефолта → null (рендерит код).
 */
export function renderWithFallbackCore(args: {
  channel: TemplateRenderChannel;
  payload: Record<string, string>;
  allowedVariables: string[];
  override: { subject: string | null; body: string } | null;
  fallbackDefault: TemplateDefaultLike | undefined;
  onOverrideError?: (error: unknown) => void;
  onDefaultError?: (error: unknown) => void;
}): RenderedWithSource | null {
  if (args.override) {
    try {
      return {
        ...renderTemplateForChannelCore({
          channel: args.channel,
          subjectTemplate: args.override.subject,
          bodyTemplate: args.override.body,
          payload: args.payload,
          allowedVariables: args.allowedVariables,
        }),
        source: "OVERRIDE",
      };
    } catch (error) {
      args.onOverrideError?.(error);
    }
  }

  if (!args.fallbackDefault || args.fallbackDefault.kind === "code") return null;

  try {
    return {
      ...renderTemplateForChannelCore({
        channel: args.channel,
        subjectTemplate: args.fallbackDefault.subject,
        bodyTemplate: args.fallbackDefault.body,
        payload: args.payload,
        allowedVariables: args.allowedVariables,
      }),
      source: "DEFAULT",
    };
  } catch (error) {
    args.onDefaultError?.(error);
    return null;
  }
}

/**
 * Рендер пары subject/body для канала: интерполяция с канальным эскейпом
 * переменных + канальная пост-обработка. Бросает TemplateRenderError при
 * неизвестных переменных — fallback решает вызывающий.
 */
export function renderTemplateForChannelCore(args: {
  channel: TemplateRenderChannel;
  subjectTemplate: string | null;
  bodyTemplate: string;
  payload: Record<string, string>;
  allowedVariables: string[];
}): RenderedTemplateContent {
  const { channel, payload, allowedVariables } = args;

  const escapeForBody =
    channel === "EMAIL" || channel === "TELEGRAM" ? escapeHtml : undefined;
  // Email subject — plain text (не HTML), telegram subject — часть HTML-сообщения
  const escapeForSubject = channel === "TELEGRAM" ? escapeHtml : undefined;

  // IN_APP — plain text: теги/entity вычищаются из САМОГО шаблона до интерполяции;
  // значения переменных не модифицируются (старый рендер сохранял в них < > &)
  const prepareTemplate =
    channel === "IN_APP"
      ? (template: string) => toPlainText(template, Number.MAX_SAFE_INTEGER)
      : (template: string) => template;

  let subject =
    args.subjectTemplate === null || args.subjectTemplate.trim() === ""
      ? null
      : interpolateTemplate({
          template: prepareTemplate(args.subjectTemplate),
          payload,
          allowedVariables,
          escapeVariable: escapeForSubject,
        });

  let body = interpolateTemplate({
    template: prepareTemplate(args.bodyTemplate),
    payload,
    allowedVariables,
    escapeVariable: escapeForBody,
  });

  switch (channel) {
    case "TELEGRAM": {
      // У Telegram нет отдельного subject — это первая строка сообщения.
      // Балансировка/санитизация применяются к ИТОГОВОЙ склейке title+body,
      // иначе тег, открытый в subject и закрытый в body (или незакрытый),
      // даёт несбалансированный HTML и Telegram отклоняет сообщение целиком.
      const composed = subject ? `${subject}\n\n${body}` : body;
      return { subject: null, body: sanitizeTelegramHtml(composed) };
    }
    case "EMAIL":
      body = sanitizeEmailHtml(body);
      break;
    case "IN_APP":
      body = truncateText(body, IN_APP_BODY_MAX_LENGTH);
      subject = subject === null ? null : truncateText(subject, IN_APP_SUBJECT_MAX_LENGTH);
      break;
  }

  return { subject, body };
}
