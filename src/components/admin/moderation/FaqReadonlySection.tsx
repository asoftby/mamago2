import { normalizeFaqItems } from "@/lib/faq/faqItems";

type FaqReadonlySectionProps = {
  items: unknown;
  className?: string;
};

export function FaqReadonlySection({ items, className }: FaqReadonlySectionProps) {
  const faqItems = normalizeFaqItems(items);

  if (faqItems.length === 0) {
    return null;
  }

  return (
    <section className={className}>
      <h3 className="mb-3 text-lg font-semibold text-gray-900">Частые вопросы</h3>
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        {faqItems.map((item) => (
          <div
            key={item.id}
            className="space-y-1 border-b border-gray-100 pb-4 last:border-b-0 last:pb-0"
          >
            <p className="text-sm font-medium text-gray-900">{item.question}</p>
            <p className="text-sm leading-6 text-gray-600">{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
