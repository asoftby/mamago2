import type { ReactNode } from "react";
import { PublicationPriceDisplay } from "@/components/shared/PublicationPriceDisplay";

const monoLabel = "font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]";

/** Date and time stay on compact rows; the final row aligns the price to the time text baseline. */
export function CollectionSchedulePrice({ label, date, detail, price }: {
  label: string;
  date?: ReactNode;
  detail?: ReactNode;
  price?: string | null;
}) {
  return (
    <div className="border-b border-[rgba(20,18,16,.1)] pb-4">
      <div className="grid grid-cols-[minmax(0,1fr)_max-content] items-baseline gap-x-4 gap-y-1.5">
        <div className={`${monoLabel} min-w-0`}>{label}</div>
        {price ? <div className={`${monoLabel} text-right`}>Стоимость</div> : null}
        <div className="col-start-1 row-start-2 min-w-0 break-words text-[15px] font-semibold leading-snug tracking-[-0.02em] [overflow-wrap:anywhere]">
          {date || <span className="font-normal text-[rgba(20,18,16,0.55)]">Расписание уточняется</span>}
        </div>
        <div className="col-start-1 row-start-3 min-w-0 break-words font-mono text-[13px] leading-snug text-[rgba(20,18,16,0.55)] [overflow-wrap:anywhere]">{detail || "\u00a0"}</div>
        {price ? (
          <div className="col-start-2 row-start-3 self-baseline">
            <PublicationPriceDisplay label={price} showLabel={false} compactAmount />
          </div>
        ) : null}
      </div>
    </div>
  );
}
