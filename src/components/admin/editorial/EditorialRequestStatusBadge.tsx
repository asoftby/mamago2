import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  string,
  {
    label: string;
    className: string;
  }
> = {
  DRAFT: {
    label: "Черновик",
    className: "border-stone-200 bg-stone-100 text-stone-700",
  },
  READY: {
    label: "Готов",
    className: "border-emerald-200 bg-emerald-100 text-emerald-700",
  },
  ARCHIVED: {
    label: "Архив",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  },
};

export function EditorialRequestStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    className: "border-stone-200 bg-stone-100 text-stone-700",
  };

  return (
    <Badge variant="outline" className={cn("rounded-full", meta.className)}>
      {meta.label}
    </Badge>
  );
}
