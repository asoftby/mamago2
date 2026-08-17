import { AdminDashboardBlock } from "../AdminDashboardBlock";
import type { ProductPulseViewModel } from "@/lib/admin/dashboardViewModels";
import { getDashboardBlock } from "@/lib/admin/dashboardBlocks";

function fmt(value: number | null): string {
  return value === null ? "Нет данных" : String(value);
}

export function ProductPulseBlock({ model }: { model: ProductPulseViewModel }) {
  const block = getDashboardBlock("product");

  return (
    <AdminDashboardBlock title={block.title} href={block.href} size={block.size}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-lg font-bold text-gray-900">{fmt(model.dau)}</div>
          <div className="text-xs text-gray-500">DAU</div>
        </div>
        <div>
          <div className="text-lg font-bold text-gray-900">{fmt(model.wau)}</div>
          <div className="text-xs text-gray-500">WAU</div>
        </div>
        <div>
          <div className="text-lg font-bold text-gray-900">{fmt(model.mau)}</div>
          <div className="text-xs text-gray-500">MAU</div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-500">WAU / MAU</span>
        <span className="text-sm font-medium text-gray-900">
          {model.wauMauRatio === null ? "Нет данных" : `${Math.round(model.wauMauRatio * 100)}%`}
        </span>
      </div>
    </AdminDashboardBlock>
  );
}
