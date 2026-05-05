// Age Range Picker Component
// Select age range for offer

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AgeRangePickerProps {
  minMonths: number | null;
  maxMonths: number | null;
  onChange: (min: number, max: number) => void;
  disabled?: boolean;
}

const AGE_OPTIONS = [
  { label: "0-1 год", minMonths: 0, maxMonths: 12 },
  { label: "1-2 года", minMonths: 12, maxMonths: 24 },
  { label: "2-3 года", minMonths: 24, maxMonths: 36 },
  { label: "3-5 лет", minMonths: 36, maxMonths: 60 },
  { label: "5-7 лет", minMonths: 60, maxMonths: 84 },
  { label: "7-10 лет", minMonths: 84, maxMonths: 120 },
  { label: "10-14 лет", minMonths: 120, maxMonths: 168 },
  { label: "14+ лет", minMonths: 168, maxMonths: 216 },
];

export function AgeRangePicker({
  minMonths,
  maxMonths,
  onChange,
  disabled = false,
}: AgeRangePickerProps) {
  const handleMinChange = (value: string) => {
    const newMin = parseInt(value);
    onChange(newMin, maxMonths || newMin + 12);
  };
  
  const handleMaxChange = (value: string) => {
    const newMax = parseInt(value);
    onChange(minMonths || 0, newMax);
  };
  
  // Get available max options based on selected min
  const availableMaxOptions = AGE_OPTIONS.filter(
    (opt) => !minMonths || opt.minMonths >= minMonths
  );
  
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium flex items-center gap-1">
        Возраст детей
        <span className="text-red-500">*</span>
      </label>
      
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Select
            value={minMonths?.toString()}
            onValueChange={handleMinChange}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="От" />
            </SelectTrigger>
            <SelectContent>
              {AGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.minMonths} value={opt.minMonths.toString()}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <span className="text-muted-foreground">—</span>
        
        <div className="flex-1">
          <Select
            value={maxMonths?.toString()}
            onValueChange={handleMaxChange}
            disabled={disabled || !minMonths}
          >
            <SelectTrigger>
              <SelectValue placeholder="До" />
            </SelectTrigger>
            <SelectContent>
              {availableMaxOptions.map((opt) => (
                <SelectItem key={opt.maxMonths} value={opt.maxMonths.toString()}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {minMonths && maxMonths && (
        <p className="text-xs text-muted-foreground">
          Выбран возраст: {monthsToYearsLabel(minMonths)} - {monthsToYearsLabel(maxMonths)}
        </p>
      )}
    </div>
  );
}

function monthsToYearsLabel(months: number): string {
  if (months < 12) {
    return `${months} мес`;
  }
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  
  if (remainingMonths === 0) {
    return `${years} ${getYearLabel(years)}`;
  }
  
  return `${years} ${getYearLabel(years)} ${remainingMonths} мес`;
}

function getYearLabel(years: number): string {
  if (years === 1) return "год";
  if (years >= 2 && years <= 4) return "года";
  return "лет";
}
