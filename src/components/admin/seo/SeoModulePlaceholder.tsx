import { cn } from "@/lib/utils";

interface SeoModulePlaceholderProps {
  title: string;
  description?: string;
  className?: string;
}

/** Пустой блок под будущие таблицы / формы / API */
export function SeoModulePlaceholder({
  title,
  description,
  className,
}: SeoModulePlaceholderProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-6 py-10 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium text-gray-800">{title}</p>
      {description ? (
        <p className="mt-2 text-xs text-gray-500 max-w-md mx-auto">{description}</p>
      ) : null}
    </div>
  );
}
