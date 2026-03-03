/**
 * Onboarding layout - provides basic styling without business guard
 * Auth is checked in the page itself
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}
