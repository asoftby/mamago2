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
};

export function CityHomeSection({
  title,
  subtitle,
  actionLabel,
  actionHref,
  actionIconButton,
  children,
  className,
  innerClassName,
}: CityHomeSectionProps) {
  return (
    <section className={cn("space-y-0", className)}>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        actionLabel={actionLabel}
        actionHref={actionHref}
        actionIconButton={actionIconButton}
      />
      <div className={cn(innerClassName)}>{children}</div>
    </section>
  );
}
