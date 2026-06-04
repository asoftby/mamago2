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
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      {children}
    </div>
  );
}
