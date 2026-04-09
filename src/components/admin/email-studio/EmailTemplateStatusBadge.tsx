import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EmailTemplateStatus } from "@/features/email-studio/lib";

const statusStyles: Record<EmailTemplateStatus, string> = {
  DRAFT: "border-amber-200 bg-amber-50 text-amber-700",
  PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ARCHIVED: "border-slate-200 bg-slate-100 text-slate-700",
};

export function EmailTemplateStatusBadge({ status }: { status: EmailTemplateStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", statusStyles[status])}
    >
      {status}
    </Badge>
  );
}
