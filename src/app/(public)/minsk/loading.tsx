import { Container } from "@/components/ui/Container";

/** Скелетон главной города — быстрый первый paint до SSR данных */
export default function MinskLoading() {
  return (
    <div className="min-h-screen bg-white pb-20 animate-pulse">
      <Container className="space-y-10 pt-10">
        <div className="space-y-3 px-1">
          <div className="h-8 w-2/3 max-w-md rounded-lg bg-neutral-200" />
          <div className="h-4 w-full max-w-xl rounded bg-neutral-100" />
        </div>
        <div className="flex gap-3 overflow-hidden px-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-28 w-20 shrink-0 rounded-2xl bg-neutral-100"
            />
          ))}
        </div>
        <div className="space-y-4 px-1">
          <div className="h-5 w-48 rounded bg-neutral-200" />
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-52 w-[42vw] min-w-[156px] max-w-[220px] rounded-2xl bg-neutral-100"
              />
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
