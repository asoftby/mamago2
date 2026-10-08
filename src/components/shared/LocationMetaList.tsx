import { cn } from "@/lib/utils";

export type LocationMetaVariant = "chips" | "inline";

export function buildLocationMetaItems({
  district,
  metro,
  tags = [],
}: {
  district?: string;
  metro?: string;
  tags?: string[];
}): string[] {
  return [
    ...(district?.trim() ? [`${district.trim()} р-н`] : []),
    ...(metro?.trim() ? [`ст. м. «${metro.trim()}»`] : []),
    ...tags.map((tag) => tag.trim()).filter(Boolean),
  ];
}

export function LocationMetaList({
  district,
  metro,
  tags = [],
  variant = "chips",
  className,
}: {
  district?: string;
  metro?: string;
  tags?: string[];
  variant?: LocationMetaVariant;
  className?: string;
}) {
  const items = buildLocationMetaItems({ district, metro, tags });
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        variant === "chips"
          ? "mb-5 flex flex-wrap gap-2"
          : "mt-1 flex flex-wrap gap-x-2.5 gap-y-1 text-[13px] leading-[1.4] text-[rgba(20,18,16,.55)]",
        className,
      )}
    >
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            "inline-flex items-center gap-1.5",
            variant === "chips" &&
              "rounded-full border border-[rgba(20,18,16,0.18)] bg-[#FAF7F1] px-3.5 py-1.5 text-[13px] font-medium text-[#141210]",
          )}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E86A3A]"
            aria-hidden
          />
          {item}
        </span>
      ))}
    </div>
  );
}
