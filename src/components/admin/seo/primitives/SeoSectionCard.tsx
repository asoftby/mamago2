import { cn } from "@/lib/utils";

export interface SeoSectionCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  id?: string;
  className?: string;
}

/**
 * Секция с заголовком и подзаголовком (Overview, таблицы, блоки настроек).
 */
export function SeoSectionCard({
  title,
  description,
  children,
  id,
  className,
}: SeoSectionCardProps) {
  return (
    <section id={id} className={cn("space-y-4", className)}>
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
