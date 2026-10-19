import { cn } from "@/lib/utils";
import {
  SectionHeader,
  type SectionHeaderProps,
} from "@/features/city-home/components/SectionHeader";

type CityHomeSectionProps = SectionHeaderProps & {
  children: React.ReactNode;
  className?: string;
  /** Доп. класс для обёртки заголовка + контента */
  innerClassName?: string;
  /** Keep desktop heading text clear of the carousel link and arrow controls. */
  reserveCarouselControls?: boolean;
};

export function CityHomeSection({
  title,
  titleCitySlug,
  subtitle,
  actionLabel,
  actionHref,
  actionIconButton,
  actionInlineText,
  headerActionClassName,
  children,
  className,
  innerClassName,
  reserveCarouselControls = false,
}: CityHomeSectionProps) {
  return (
    <section className={cn("space-y-0", className)}>
      <SectionHeader
        title={title}
        titleCitySlug={titleCitySlug}
        subtitle={subtitle}
        actionLabel={actionLabel}
        actionHref={actionHref}
        actionIconButton={actionIconButton}
        actionInlineText={actionInlineText}
        headerActionClassName={headerActionClassName}
        className={reserveCarouselControls ? "lg:pr-[250px]" : undefined}
      />
      <div className={cn(innerClassName)}>{children}</div>
    </section>
  );
}
