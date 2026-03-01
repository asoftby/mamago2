import { Suspense } from "react";
import IdentityFiltersClient from "./Client";

export default function FiltersUILabPage() {
  return (
    <Suspense fallback={null}>
      <IdentityFiltersClient />
    </Suspense>
  );
}
