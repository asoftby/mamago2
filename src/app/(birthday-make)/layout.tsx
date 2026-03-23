/**
 * Minimal layout for Birthday Builder (/[city]/birthday/make).
 * No global header, no footer, no mobile nav — focused constructor flow.
 */
export default function BirthdayMakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/30 to-white flex flex-col">
      {children}
    </div>
  );
}
