type IdeasHeaderProps = {
  totalCount: number;
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

export function IdeasHeader({ totalCount }: IdeasHeaderProps) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[rgba(20,18,16,0.06)] bg-white px-5 py-6 shadow-[0_18px_40px_rgba(20,18,16,0.05)] sm:px-8 sm:py-8">
      <div className="pointer-events-none absolute right-[-32px] top-[-48px] h-32 w-32 rounded-full bg-[#EF8759]/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-40px] left-[-24px] h-28 w-28 rounded-full bg-[#F4E7D8] blur-3xl" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="space-y-2">
            <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-[#141210] sm:text-[38px]">
              Мои идеи
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-[rgba(20,18,16,0.62)] sm:text-[15px]">
              Сохранённые активности, которые можно запланировать позже
            </p>
          </div>
        </div>

        <div className="inline-flex w-fit items-center rounded-full border border-[#EF8759]/15 bg-[#FFF5EE] px-4 py-2 text-sm font-medium text-[#C65D2E]">
          {formatIdeasCount(totalCount)}
        </div>
      </div>
    </section>
  );
}
