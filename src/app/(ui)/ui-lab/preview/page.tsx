import { PreviewCanvas } from "./_components/PreviewCanvas";

const demos = new Set(["buttons", "chips", "fields", "badges"]);

export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo } = await searchParams;
  return <PreviewCanvas demo={demo && demos.has(demo) ? demo : "buttons"} />;
}
