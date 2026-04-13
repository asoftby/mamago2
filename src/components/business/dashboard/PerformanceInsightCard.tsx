import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";

export function PerformanceInsightCard(props: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <BusinessSurfaceCard className="p-5 md:p-6">
      <p className="text-sm font-medium text-stone-500">{props.label}</p>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-stone-950 md:text-[1.75rem]">
        {props.value}
      </p>
      <p className="mt-3 max-w-[32rem] text-sm leading-7 text-stone-600">{props.helper}</p>
    </BusinessSurfaceCard>
  );
}
