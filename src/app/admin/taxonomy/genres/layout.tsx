import { Suspense } from "react";

export default function TaxonomyGenresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">Загрузка…</div>}>
      {children}
    </Suspense>
  );
}
