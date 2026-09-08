import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { articleBlockHtmlForPublic } from "@/lib/article/articleBlockHtml";
import type { ArticleCalloutVariant } from "@/lib/publications/articleMvp";

const VARIANT_CONFIG: Record<
  ArticleCalloutVariant,
  { Icon: typeof Lightbulb; label: string; classes: string; iconClasses: string }
> = {
  tip: {
    Icon: Lightbulb,
    label: "Совет",
    classes: "bg-[var(--success-soft)] border-[var(--success)]",
    iconClasses: "text-[var(--success-hover)]",
  },
  warning: {
    Icon: AlertTriangle,
    label: "Внимание",
    classes: "bg-[var(--warning-soft)] border-[var(--warning)]",
    iconClasses: "text-[var(--warning-hover)]",
  },
  info: {
    Icon: Info,
    label: "Информация",
    classes: "bg-[var(--info-soft)] border-[var(--info)]",
    iconClasses: "text-[var(--info-hover)]",
  },
};

export function ArticleCalloutBlock({
  variant,
  title,
  text,
}: {
  variant: ArticleCalloutVariant;
  title?: string;
  text: string;
}) {
  const { Icon, label, classes, iconClasses } = VARIANT_CONFIG[variant];
  const titleTrim = title?.trim();

  return (
    <div
      role="note"
      aria-label={titleTrim || label}
      className={cn(
        "not-prose my-6 md:my-8 flex gap-3 rounded-xl border-l-4 px-4 py-4 md:px-5 md:py-5",
        classes,
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", iconClasses)} aria-hidden />
      <div className="min-w-0 flex-1">
        {titleTrim ? (
          <p className="font-sans font-semibold text-[15px] md:text-base text-foreground mb-1">
            {titleTrim}
          </p>
        ) : null}
        <div
          className="font-sans text-[15px] md:text-base leading-relaxed text-foreground/90 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2"
          dangerouslySetInnerHTML={{ __html: articleBlockHtmlForPublic(text, "text") }}
        />
      </div>
    </div>
  );
}
