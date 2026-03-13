import { ReactNode } from "react";

interface SectionWrapperProps {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function SectionWrapper({ id, title, description, children }: SectionWrapperProps) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>
      <div className="space-y-6">
        {children}
      </div>
    </section>
  );
}
