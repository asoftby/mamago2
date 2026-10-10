import { formatPlanTargetDateShortRu } from "@/lib/date/formatPlanTargetDateRu";
import { requestOpenMyPlan } from "@/lib/my-plan/myPlanOpenIntent";
import { toast } from "@/lib/toast";

/** «Добавлено в план на ср, 14 · Открыть» — «Открыть» показывает план. */
export function toastAddedToPlan(dateISO: string) {
  toast.success(`Добавлено в план на ${formatPlanTargetDateShortRu(dateISO)}`, {
    action: { label: "Открыть", onClick: () => requestOpenMyPlan() },
  });
}
