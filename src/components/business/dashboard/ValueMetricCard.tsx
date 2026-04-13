import { cn } from "@/lib/utils";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";

export function ValueMetricCard(props: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "accent" | "success";
}) {
  const tone = props.tone ?? "neutral";

  return (
    <BusinessSurfaceCard
      tone={tone}
      className={cn(
        "p-5 md:p-6"
      )}
    >
      <p className="text-sm font-medium text-stone-500">{props.label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-stone-950 md:text-[2rem]">
        {props.value}
      </p>
      <p className="mt-3 max-w-[26rem] text-sm leading-7 text-stone-600">{props.hint}</p>
    </BusinessSurfaceCard>
  );
}
