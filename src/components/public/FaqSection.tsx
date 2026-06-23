import type { FaqItem } from "@/lib/faq/faqItems";
import { normalizeFaqItems } from "@/lib/faq/faqItems";

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
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
            Вопросы
          </span>
          <span className="h-px flex-1 bg-[rgba(20,18,16,0.10)]" />
        </div>

        <h2 className="mb-8 text-3xl font-semibold tracking-[-0.02em] text-[#141210]">
          Частые вопросы
        </h2>

        <div className="space-y-4">
          {normalized.map((item) => (
            <details
              key={item.id}
              className="group rounded-3xl border border-[rgba(20,18,16,0.10)] bg-white p-5"
            >
              <summary className="cursor-pointer list-none pr-8 text-lg font-medium text-[#141210]">
                {item.question}
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
