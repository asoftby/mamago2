import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/utils";

export type PublicationFact = { id: string; label: string; value: string };

// Extracted from Event unchanged: keep its existing editorial appearance.
/* ── Meta strip ───────────────────────────────────────────── */
export function PublicationFactsStrip({ facts }: { facts: PublicationFact[] }) {
  if (!facts.length) return null;
  return (
    <section className="border-y border-[rgba(20,18,16,0.10)]">
      <Container>
        <div
          className="grid grid-cols-2 md:grid-cols-4"
        >

          {facts.map((f, i) => (
            <div
              key={f.id}
              className={cn(
                "flex flex-col gap-1.5 py-5",
                i % 2 !== 0 ? "border-l border-[rgba(20,18,16,0.10)] px-4" : "pr-4",
                i < 2 && "border-b border-[rgba(20,18,16,0.10)] md:border-b-0",
                i > 0 && "md:border-l md:border-[rgba(20,18,16,0.10)] md:px-5",
                i === 0 && "md:pr-5",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]" style={{ fontFamily: "Menlo, monospace" }}>
                  {f.label}
                </span>
                <span className="font-mono text-[11px] text-[rgba(20,18,16,0.55)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="text-[17px] font-medium leading-snug tracking-[-0.01em] text-[#141210]">
                {f.value}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
