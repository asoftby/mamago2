import Link from "next/link";
import { C } from "../theme";

type IdeasHeaderProps = {
  totalCount: number;
  plannedCount: number;
  unplannedCount: number;
};

function formatIdeasCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} идея`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} идеи`;
  }
  return `${count} идей`;
}

export function IdeasHeader({ totalCount, plannedCount, unplannedCount }: IdeasHeaderProps) {
  return (
    <div>
      <div
        className="flex items-center gap-2 pb-4 text-[13px]"
        style={{ color: C.ink3 }}
      >
        <Link href="/me" className="inline-flex items-center gap-1.5" style={{ color: "inherit" }}>
          ← Профиль
        </Link>
        <span style={{ opacity: 0.5 }}>→</span>
        <span style={{ color: C.ink }}>Мои идеи</span>
      </div>

      <section
        className="relative flex flex-col gap-6 pb-2 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="max-w-2xl space-y-3">
          <h1
            className="text-[44px] leading-[0.94] tracking-[-0.03em] sm:text-[64px]"
            style={{ fontFamily: "var(--font-ideas-serif)", fontWeight: 400, color: C.ink }}
          >
            Мои{" "}
            <span style={{ fontStyle: "italic", color: C.accentDeep }}>идеи.</span>
          </h1>
          <p className="text-[15px] leading-6 sm:text-[17px]" style={{ color: C.ink2 }}>
            Сохранённые активности, которые можно запланировать позже. Перенесите в план
            в любой момент — мы напомним накануне.
          </p>
        </div>

        <div
          className="inline-flex w-fit flex-col gap-1 rounded-2xl border px-4 py-3 text-right sm:min-w-[220px]"
          style={{ borderColor: C.line, background: C.paper }}
        >
          <span
            className="font-mono text-[11px] uppercase tracking-[0.14em]"
            style={{ color: C.accentDeep }}
          >
            ● в коллекции
          </span>
          <span
            className="text-[30px] leading-none tracking-[-0.02em]"
            style={{ fontFamily: "var(--font-ideas-serif)", fontWeight: 400, color: C.ink }}
          >
            {formatIdeasCount(totalCount)}
          </span>
          <span
            className="font-mono text-[11px] uppercase tracking-[0.06em]"
            style={{ color: C.ink3 }}
          >
            ● {unplannedCount} без даты · {plannedCount} в плане
          </span>
        </div>
      </section>
    </div>
  );
}
