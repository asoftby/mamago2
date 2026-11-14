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

/** Счётчик и кнопка «Создать» — справа от заголовка AccountPage. */
export function RoutesHeaderActions({ totalCount }: RoutesHeaderProps) {
  return (
    <>
      <span className="text-sm text-neutral-600">{formatRoutesCount(totalCount)}</span>
      <Link
        href="/routes/new"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Создать
      </Link>
    </>
  );
}
