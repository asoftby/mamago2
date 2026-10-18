import type { Metadata } from "next";

// Reuse the authenticated ideas data loader and layout.
// IdeasClient selects the collection from the dynamic route parameter.
export { default } from "../../page";

export const metadata: Metadata = { title: "Коллекция идей — mamaGo" };
