import Link, { isAllowedUri } from "@tiptap/extension-link";

const DEFAULT_APP_ORIGIN = "https://mamago.by";

export function getPublicAppOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return DEFAULT_APP_ORIGIN;
}

/**
 * Внешние ссылки: target=_blank и rel по правилам.
 * Внутренние (тот же origin, относительные пути, якоря): без target/rel — остаются follow.
 * Рекламная пометка: data-sponsored для повторного редактирования.
 */
export function computeArticleLinkAttrs(
  href: string,
  sponsored: boolean,
  appOrigin: string = getPublicAppOrigin(),
): Record<string, string> {
  const h = (href ?? "").trim();
  const base = appOrigin.replace(/\/$/, "");
  let internal = false;
  if (h.startsWith("#")) {
    internal = true;
  } else if (h.startsWith("/") && !h.startsWith("//")) {
    internal = true;
  } else {
    try {
      const u = new URL(h, `${base}/`);
      internal = u.origin === new URL(base).origin;
    } catch {
      internal = false;
    }
  }

  const out: Record<string, string> = {};

  if (internal) {
    if (sponsored) out["data-sponsored"] = "true";
    return out;
  }

  out.target = "_blank";
  out.rel = sponsored
    ? "nofollow sponsored noopener noreferrer"
    : "noopener noreferrer";
  if (sponsored) out["data-sponsored"] = "true";
  return out;
}

function parseSponsoredFromElement(el: HTMLElement): boolean {
  if (el.getAttribute("data-sponsored") === "true") return true;
  const rel = el.getAttribute("rel") ?? "";
  return /\bsponsored\b/.test(rel);
}

export const ArticleBodyLink = Link.extend({
  name: "link",

  addAttributes() {
    return {
      ...this.parent?.(),
      sponsored: {
        default: false,
        parseHTML: (element) => parseSponsoredFromElement(element as HTMLElement),
      },
    };
  },

  renderHTML({ HTMLAttributes, mark }) {
    const href = HTMLAttributes.href;
    if (
      !this.options.isAllowedUri(String(href), {
        defaultValidate: (u: string) => !!isAllowedUri(u, this.options.protocols),
        protocols: this.options.protocols,
        defaultProtocol: this.options.defaultProtocol,
      })
    ) {
      return [
        "a",
        {
          ...this.options.HTMLAttributes,
          ...HTMLAttributes,
          href: "",
        },
        0,
      ];
    }

    const sponsored = Boolean(mark.attrs.sponsored);
    const computed = computeArticleLinkAttrs(String(href), sponsored);

    return [
      "a",
      {
        ...this.options.HTMLAttributes,
        ...HTMLAttributes,
        href: String(href),
        ...computed,
      },
      0,
    ];
  },
});
