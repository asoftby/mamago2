import { Badge } from "@/components/ui/badge";
import type { BuildInfo } from "@/lib/system/buildInfo";
import { cn } from "@/lib/utils";

type BuildModeBadgeProps = {
  buildInfo: BuildInfo;
  compact?: boolean;
};

const TONE_CLASS_BY_MODE: Record<BuildInfo["tone"], string> = {
  production: "border-emerald-200 bg-emerald-50 text-emerald-700",
  staging: "border-amber-200 bg-amber-50 text-amber-700",
  development: "border-sky-200 bg-sky-50 text-sky-700",
  local: "border-slate-200 bg-slate-100 text-slate-700",
  unknown: "border-gray-200 bg-gray-100 text-gray-700",
};

export function BuildModeBadge({
  buildInfo,
  compact = false,
}: BuildModeBadgeProps) {
  const compactText = buildInfo.commitShortSha
    ? `${buildInfo.label} · v${buildInfo.appVersion} · ${buildInfo.commitShortSha}`
    : `${buildInfo.label} · v${buildInfo.appVersion}`;

  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-mono text-[10px] uppercase tracking-[0.14em]",
        TONE_CLASS_BY_MODE[buildInfo.tone],
      )}
    >
      {compact ? compactText : buildInfo.label}
    </Badge>
  );
}
