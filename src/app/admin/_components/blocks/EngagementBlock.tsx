import { AdminDashboardBlock } from "../AdminDashboardBlock";
import { deriveStageConversion, type EngagementViewModel } from "@/lib/admin/dashboardViewModels";
import { getDashboardBlock } from "@/lib/admin/dashboardBlocks";

function fmt(value: number | null): string {
  return value === null ? "Нет данных" : String(value);
}

function fmtConversion(from: number | null, to: number | null): string {
  const ratio = deriveStageConversion(from, to);
  return ratio === null ? "—" : `${Math.round(ratio * 100)}%`;
}

const STAGES: { key: keyof EngagementViewModel; label: string }[] = [
  { key: "contentOpens", label: "Открытия" },
  { key: "saves", label: "Сохранения" },
  { key: "planAdds", label: "В план" },
  { key: "ctaClicks", label: "CTA" },
];

export function EngagementBlock({ model }: { model: EngagementViewModel }) {
  const block = getDashboardBlock("engagement");

  return (
    <AdminDashboardBlock title={block.title} size={block.size}>
      <div className="space-y-2">
        {STAGES.map((stage, i) => {
          const prev = i > 0 ? model[STAGES[i - 1].key] : null;
          const value = model[stage.key];
          return (
            <div key={stage.key} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{stage.label}</span>
              <span className="flex items-center gap-2">
                {i > 0 && <span className="text-xs text-gray-400">{fmtConversion(prev, value)}</span>}
                <span className="font-medium text-gray-900 w-10 text-right">{fmt(value)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </AdminDashboardBlock>
  );
}
