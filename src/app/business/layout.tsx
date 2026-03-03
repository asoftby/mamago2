/**
 * Business root layout - simple passthrough
 * Auth guards are handled in (protected) route group
 * Onboarding route is unguarded
 */
export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
