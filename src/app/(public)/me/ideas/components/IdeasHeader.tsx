import Link from "next/link";
import { C } from "../theme";

export function IdeasHeader() {
  return (
    <div>
      <div className="flex items-center gap-2 pb-4 text-[13px]" style={{ color: C.ink3 }}>
        <Link href="/me" className="inline-flex items-center gap-1.5" style={{ color: "inherit" }}>
          ← Профиль
        </Link>
        <span style={{ opacity: 0.5 }}>→</span>
        <span style={{ color: C.ink }}>Мои идеи и коллекции</span>
      </div>

      <section className="relative flex flex-col gap-6 pb-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl space-y-3">
          <h1
            className="text-[38px] leading-[1.02] tracking-[-0.03em] sm:text-[58px]"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 400, color: C.ink }}
          >
            Мои идеи и коллекции
          </h1>
          <p className="text-[15px] leading-6 sm:text-[17px]" style={{ color: C.ink2 }}>
            Сохраняйте понравившиеся активности, собирайте их в коллекции и переносите в план, когда удобно.
          </p>
        </div>
      </section>
    </div>
  );
}
