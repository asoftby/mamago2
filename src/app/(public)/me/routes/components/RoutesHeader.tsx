import Link from "next/link";
import { Plus } from "lucide-react";

type RoutesHeaderProps = {
  totalCount: number;
};

function formatRoutesCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} маршрут`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} маршрута`;
  }
  return `${count} маршрутов`;
}

export function RoutesHeader({ totalCount }: RoutesHeaderProps) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[rgba(20,18,16,0.06)] bg-white px-5 py-6 shadow-[0_18px_40px_rgba(20,18,16,0.05)] sm:px-8 sm:py-8">
      <div className="pointer-events-none absolute right-[-32px] top-[-48px] h-32 w-32 rounded-full bg-[#EF8759]/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-40px] left-[-24px] h-28 w-28 rounded-full bg-[#F4E7D8] blur-3xl" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-[#141210] sm:text-[38px]">
            Мои маршруты
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[rgba(20,18,16,0.62)] sm:text-[15px]">
            Маршруты, которые вы создали — черновики и опубликованные
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex w-fit items-center rounded-full border border-[#EF8759]/15 bg-[#FFF5EE] px-4 py-2 text-sm font-medium text-[#C65D2E]">
            {formatRoutesCount(totalCount)}
          </div>
          <Link
            href="/routes/new"
            className="inline-flex items-center gap-2 rounded-full bg-[#141210] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a2825] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Создать
          </Link>
        </div>
      </div>
    </section>
  );
}
