import type { FaqItem } from "@/lib/faq/faqItems";
import { normalizeFaqItems } from "@/lib/faq/faqItems";
import { Plus } from "lucide-react";

type FaqSectionProps = {
  items: FaqItem[] | null | undefined;
};

export function FaqSection({ items }: FaqSectionProps) {
  const normalized = normalizeFaqItems(items);
  if (normalized.length === 0) return null;

  return (
    <section className="border-t border-[rgba(20,18,16,0.10)] py-16 md:py-20">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3.5">
          <span className="text-kicker">
            Вопросы
          </span>
          <span className="h-px flex-1 bg-[rgba(20,18,16,0.10)]" />
        </div>

        <h2
          className="mb-8"
          style={{
            fontSize: 30,
            lineHeight: 1,
            margin: 0,
            letterSpacing: "-.02em",
            color: "#141210",
            fontFamily: "var(--font-sans)",
            fontWeight: 400,
          }}
        >
          Частые{" "}
          <em
            style={{
              fontFamily: "var(--font-editorial)",
              fontStyle: "italic",
              fontWeight: 400,
              color: "#E86A3A",
            }}
          >
            вопросы
          </em>
        </h2>

        <div className="mt-[30px] space-y-4">
          {normalized.map((item) => (
            <details
              key={item.id}
              className="group rounded-3xl border border-[rgba(20,18,16,0.10)] bg-white p-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium text-[#141210]">
                <span>{item.question}</span>
                <Plus
                  aria-hidden
                  className="size-[33px] shrink-0 self-center stroke-[1.25] text-[rgba(20,18,16,0.55)] transition-transform duration-200 group-open:rotate-45"
                />
              </summary>
              <p className="mt-4 whitespace-pre-wrap text-base leading-7 text-[#4B443C]">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
