import { CityShell } from "@/components/city/CityShell";

export type KudaDiscoveryPageProps = {
  citySlug: string;
  searchParams: Record<string, string | string[] | undefined>;
};

/**
 * Публичная страница «Куда пойти» (discovery по городу).
 * Не привязана к конкретному URL — подключается из `/{city}/events` (канон) или алиасов.
 */
export async function KudaDiscoveryPage({
  citySlug,
  searchParams,
}: KudaDiscoveryPageProps) {
  return (
    <CityShell citySlug={citySlug} intent="kuda" searchParams={searchParams} />
  );
}
