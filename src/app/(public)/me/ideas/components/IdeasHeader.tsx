import Link from "next/link";
import { C } from "../theme";

export function IdeasHeader() {
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
            style={{ fontFamily: "var(--font-display)", fontWeight: 400, color: C.ink }}
          >
            Мои{" "}
            <span style={{ fontStyle: "italic", color: C.accentDeep }}>идеи.</span>
          </h1>
          <p className="text-[15px] leading-6 sm:text-[17px]" style={{ color: C.ink2 }}>
            Сохранённые активности, которые можно запланировать позже. Перенесите в план
            в любой момент — мы напомним накануне.
          </p>
        </div>

      </section>
    </div>
  );
}
