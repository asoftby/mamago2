import { Badge } from "@/components/ui/badge";
import { getSystemInterestLabel } from "@/lib/config/interests";

interface ChildData {
  id: string;
  name: string;
  birthDate: Date;
  systemInterests?: { interestSlug: string }[];
  customInterests?: { label: string }[];
}

interface ChildCardProps {
  child: ChildData;
  onClick?: () => void;
}

export function ChildCard({ child, onClick }: ChildCardProps) {
  console.log("ChildCard render - child:", child, "onClick:", !!onClick);
  
  const handleClick = () => {
    console.log("ChildCard clicked, child data:", child);
    onClick?.();
  };
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
    if (years === 0) return "меньше года";
    if (years === 1) return "1 год";
    if (years >= 2 && years <= 4) return `${years} года`;
    return `${years} лет`;
  };

  const age = calculateAge(child.birthDate);
  const systemInterests = child.systemInterests || [];
  const customInterests = child.customInterests || [];
  const hasInterests = systemInterests.length > 0 || customInterests.length > 0;

  return (
    <div 
      className="border border-gray-200 rounded-lg p-4 bg-white cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={handleClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium text-gray-900">{child.name}</h3>
          <p className="text-sm text-gray-600">{formatAge(age)}</p>
        </div>
      </div>

      {hasInterests && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">
            Интересы
          </p>
          <div className="flex flex-wrap gap-1.5">
            {/* System interests */}
            {systemInterests.map((interest) => (
              <Badge
                key={interest.interestSlug}
                variant="secondary"
                className="text-xs h-6 px-2 bg-[#EF8759]/10 text-[#EF8759] border-[#EF8759]/20"
              >
                {getSystemInterestLabel(interest.interestSlug)}
              </Badge>
            ))}
            
            {/* Custom interests */}
            {customInterests.map((interest, index) => (
              <Badge
                key={index}
                variant="outline"
                className="text-xs h-6 px-2 bg-gray-50 text-gray-700 border-gray-200"
              >
                {interest.label}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}