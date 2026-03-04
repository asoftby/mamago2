import { Surface } from "@/components/ui/surface";
import { H2, Body, BodyMuted, Caption } from "@/components/ui/typography";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { AddChildForm } from "@/app/(public)/me/AddChildForm";
import type { Child } from "@prisma/client";

type ChildrenCardProps = {
  children: Child[];
};

export function ChildrenCard({ children }: ChildrenCardProps) {
  const calculateAge = (birthDate: Date): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let years = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      years--;
    }
    
    return years;
  };

  const formatAge = (years: number): string => {
    if (years === 1) return "1 год";
    if (years >= 2 && years <= 4) return `${years} года`;
    return `${years} лет`;
  };

  return (
    <Surface variant="elevated" className="p-6">
      {children.length > 0 ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <H2>Мои дети</H2>
          </div>

          <div className="space-y-3 mb-6">
            {children.map((child) => {
              const age = calculateAge(child.birthDate);
              
              return (
                <div
                  key={child.id}
                  className="border border-border rounded-lg p-4"
                >
                  <Body className="font-medium mb-1">{child.name}</Body>
                  <Caption className="block mb-2">
                    {formatAge(age)}
                  </Caption>
                  {child.interests && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {child.interests.split(",").map((interest, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                        >
                          {interest.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-border pt-6">
            <AddChildForm />
          </div>
        </>
      ) : (
        <>
          <H2 className="mb-3">Добавьте ребёнка</H2>
          <BodyMuted className="mb-6">
            Мы будем подбирать события по возрасту и интересам.
          </BodyMuted>
          <AddChildForm />
        </>
      )}
    </Surface>
  );
}
