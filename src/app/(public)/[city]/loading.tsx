import { Container } from "@/components/ui/Container";

export default function CityLoading() {
  return (
    <div className="min-h-screen bg-white pb-20 animate-pulse">
      <Container className="pt-6 space-y-6">
        <div className="h-9 w-3/4 max-w-sm rounded-lg bg-neutral-200 px-1" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-neutral-100" />
          ))}
        </div>
      </Container>
    </div>
  );
}
