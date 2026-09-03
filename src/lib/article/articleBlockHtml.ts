/**
 * Санитизация HTML блоков статьи.
 *
 * Использует легковесный allowlist-санитайзер без зависимостей
 * (jsdom / DOMPurify), что гарантирует 100 % SSR-безопасность.
 * Поддерживает фильтрацию тегов/атрибутов по белому списку
 * и блокировку опасных протоколов (javascript:, data:, vbscript:).
 */

export type ArticleBlockHtmlVariant = "intro" | "text" | "quote";

const RICH_TEXT_TAGS = ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a", "div"];
const RICH_TEXT_ATTRS = ["href", "target", "rel", "class", "data-sponsored"];

const TAGS: Record<ArticleBlockHtmlVariant, string[]> = {
  intro: RICH_TEXT_TAGS,
  text: RICH_TEXT_TAGS,
  quote: ["p", "br", "em", "i"],
};

const ALLOWED_ATTRS_BY_VARIANT: Record<ArticleBlockHtmlVariant, string[]> = {
  intro: RICH_TEXT_ATTRS,
  text: RICH_TEXT_ATTRS,
  quote: [],
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Heuristic: stored value looks like HTML from TipTap / editor, not plain text. */
export function articleBlockTextLooksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test((text ?? "").trim());
}

/**
 * Legacy plain text → minimal HTML for TipTap (`<p>`, `<br>`).
 * If the string already looks like HTML, returns it unchanged (then sanitize).
 */
export function legacyPlainTextToEditorHtml(text: string): string {
  const t = text ?? "";
  if (!t.trim()) return "<p></p>";
  if (articleBlockTextLooksLikeHtml(t)) return t;
  return `<p>${escapeHtml(t).replace(/\n/g, "<br>")}</p>`;
}

/**
 * Allowlist-санитизация через простой парсинг тегов (без DOMPurify / jsdom).
 * Удаляет все теги кроме разрешённых, фильтрует атрибуты,
 * блокирует опасные протоколы (javascript:, data:, vbscript:).
 *
 * 100 % SSR-safe — не требует jsdom / DOMPurify.
 * Сохраняет текстовое содержимое удалённых тегов.
 *
 * Экспортируется для использования в articleEmbedSanitize.ts.
 */
export function sanitizeHtmlAllowlist(
  html: string,
  allowedTags: string[],
  allowedAttrs: string[],
): string {
  if (!html) return "";

  const allowedTagSet = new Set(allowedTags.map((t) => t.toLowerCase()));
  const allowedAttrSet = new Set(allowedAttrs.map((a) => a.toLowerCase()));

  /**
   * Проверяет, разрешён ли атрибут.
   * data-* атрибуты всегда разрешены (backward compat с DOMPurify ALLOW_DATA_ATTR).
   */
  function isAttrAllowed(name: string): boolean {
    const lower = name.toLowerCase();
    return allowedAttrSet.has(lower) || lower.startsWith("data-");
  }

  /**
   * Проверяет, что протокол в значении атрибута безопасен.
   * Блокирует javascript:, data:, vbscript:, file:
   * Пропускает http(s):, mailto:, tel:, ftp: и схемо-безадресные значения.
   */
  function isDangerousProtocol(value: string): boolean {
    const trimmed = value.trim();
    // Только если похоже на URI-схему (буквы, цифры, +, -, . и :)
    if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return false;
    return /^(javascript|data|vbscript|file):/i.test(trimmed);
  }

  // ─── Pre-process: полностью удаляем опасные элементы вместе с содержимым ────
  // DOMPurify удаляет script, style, template и noscript целиком,
  // а не только открывающие/закрывающие теги. Повторяем это поведение.
  const DANGEROUS_TAGS = ["script", "style", "template", "noscript"];
  let result = html;
  for (const tag of DANGEROUS_TAGS) {
    // Удаляем <tag ...>...</tag> целиком
    result = result.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "");
    // Удаляем самозакрывающиеся варианты <tag ... />
    result = result.replace(new RegExp(`<${tag}\\b[^>]*\\/>`, "gi"), "");
  }

  // 1. Блокируем опасные протоколы в href, src, action и formaction
  result = result.replace(
    /(\s)(href|src|action|formaction|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (_, space, attrName, dq, sq, uq) => {
      const val = (dq ?? sq ?? uq ?? "").trim();
      if (isDangerousProtocol(val)) {
        return `${space}${attrName}=""`;
      }
      return _;
    },
  );

  // 2. Фильтруем теги: удаляем запрещённые, фильтруем атрибуты у разрешённых
  result = result.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (full, tagName, rest) => {
    const tag = tagName.toLowerCase();
    if (!allowedTagSet.has(tag)) {
      // Удаляем только тег, но не его содержимое
      return "";
    }
    // Закрывающий тег — просто нормализуем
    if (full.startsWith("</")) {
      return `</${tag}>`;
    }
    // Самозакрывающийся тег (br, hr и т.д. или с />)
    const isVoid = ["br", "hr", "img", "input", "meta", "link"].includes(tag);
    const isSelfClose = isVoid || /\s\/>$/.test(full);

    // Извлекаем и фильтруем атрибуты
    const rawAttrs: string[] = [];
    const attrRe = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let attrMatch;
    while ((attrMatch = attrRe.exec(rest)) !== null) {
      rawAttrs.push(attrMatch[0]);
    }
    // Также захватываем булевы атрибуты (без значения)
    const boolRe = /\s+([a-z][a-z0-9-]*)\b(?=\s|>|$)/gi;
    while ((attrMatch = boolRe.exec(rest)) !== null) {
      const bName = attrMatch[1].trim();
      if (bName && !bName.includes("=")) {
        rawAttrs.push(bName);
      }
    }

    const kept = rawAttrs.filter((a) => {
      const eqIdx = a.indexOf("=");
      const name = eqIdx > 0 ? a.slice(0, eqIdx).trim() : a.trim();
      return isAttrAllowed(name);
    });

    const attrStr = kept.length ? ` ${kept.join(" ")}` : "";
    return isSelfClose ? `<${tag}${attrStr}>` : `<${tag}${attrStr}>`;
  });

  // 3. Гарантируем rel="noopener noreferrer" для target="_blank"
  result = result.replace(
    /<a\b([^>]*?)target="_blank"([^>]*)>/gi,
    (match) => {
      const withoutRel = match.replace(
        /\s+rel\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
        "",
      );
      return withoutRel.replace(/\s*>$/, ' rel="noopener noreferrer">');
    },
  );

  return result;
}

/** Safe HTML for editor initial content and for public render. */
export function sanitizeArticleBlockHtml(
  html: string,
  variant: ArticleBlockHtmlVariant,
): string {
  return sanitizeHtmlAllowlist(html, TAGS[variant], ALLOWED_ATTRS_BY_VARIANT[variant]);
}

export function articleBlockHtmlForEditor(
  raw: string,
  variant: ArticleBlockHtmlVariant,
): string {
  const prepared = legacyPlainTextToEditorHtml(raw);
  return sanitizeArticleBlockHtml(prepared, variant);
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function extractHtmlAttribute(attrs: string, name: string): string {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match?.[1] ? decodeHtmlAttribute(match[1]) : "";
}

function renderInlineQuoteBlocks(html: string): string {
  return html.replace(
    /<div\b([^>]*)data-type="quote-block"([^>]*)>([\s\S]*?)<\/div>/gi,
    (_full, beforeAttrs, afterAttrs, innerHtml) => {
      const attrs = `${beforeAttrs ?? ""} ${afterAttrs ?? ""}`;
      const author = extractHtmlAttribute(attrs, "data-author").trim();
      const authorRole = extractHtmlAttribute(attrs, "data-author-role").trim();
      const footer =
        author || authorRole
          ? `<footer style="margin-top:14px;font-size:13px;line-height:1.4;font-weight:400;opacity:.68;font-family:var(--font-sans),system-ui,sans-serif;">${
              author ? `<span>&mdash; ${escapeHtml(author)}</span>` : ""
            }${
              author && authorRole ? `<span style="margin:0 8px;">&middot;</span>` : ""
            }${authorRole ? `<span>${escapeHtml(authorRole)}</span>` : ""}</footer>`
          : "";

      return `<blockquote style="display:flex;gap:20px;margin:32px 0;padding:0;"><div style="width:3px;flex-shrink:0;align-self:stretch;border-radius:999px;background:var(--primary);"></div><div style="min-width:0;flex:1;padding-block:4px;"><div style="font-style:italic;">${innerHtml}</div>${footer}</div></blockquote>`;
    },
  );
}

export function articleBlockHtmlForPublic(
  raw: string,
  variant: ArticleBlockHtmlVariant,
): string {
  const sanitized = articleBlockHtmlForEditor(raw, variant);
  if (variant === "quote") return sanitized;
  return renderInlineQuoteBlocks(sanitized);
}
