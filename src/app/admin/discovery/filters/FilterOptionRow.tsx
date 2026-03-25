"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, ArrowUp, ArrowDown, Save } from "lucide-react";

type Option = {
  id: string;
  label: string;
  value: string;
  order: number;
  orderIndex: number;
  isActive: boolean;
};

interface FilterOptionRowProps {
  option: Option;
  index: number;
  totalOptions: number;
  onUpdate: (id: string, data: Partial<Option>) => Promise<boolean>;
  onReorder: (id: string, direction: "UP" | "DOWN") => void;
  onDelete: (id: string) => void;
}

export function FilterOptionRow({
  option,
  index,
  totalOptions,
  onUpdate,
  onReorder,
  onDelete,
}: FilterOptionRowProps) {
  const labelInputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState(option.label);
  const [value, setValue] = useState(option.value);
  const [isActive, setIsActive] = useState(option.isActive);
  const [isDirty, setIsDirty] = useState(false);

  // Sync with props if they change externally (e.g. reorder)
  useEffect(() => {
    setLabel(option.label);
    setValue(option.value);
    setIsActive(option.isActive);
    setIsDirty(false);
  }, [option.label, option.value, option.isActive]);

  const handleSave = async () => {
    const ok = await onUpdate(option.id, { label, value, isActive });
    if (ok) {
      setIsDirty(false);
      labelInputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 border rounded bg-muted/20">
      <div className="flex flex-col gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          disabled={index === 0}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onReorder(option.id, "UP");
          }}
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          disabled={index === totalOptions - 1}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onReorder(option.id, "DOWN");
          }}
        >
          <ArrowDown className="h-3 w-3" />
        </Button>
      </div>
      
      <Input
        ref={labelInputRef}
        className="w-[120px]"
        value={label}
        onChange={(e) => {
          setLabel(e.target.value);
          setIsDirty(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Label"
      />
      
      <Input
        className="w-[120px] font-mono text-xs"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setIsDirty(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Value"
      />
      
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs text-muted-foreground font-mono">
          #{option.orderIndex}
        </span>
        
        <Checkbox
          checked={isActive}
          onCheckedChange={(c) => {
            const newVal = !!c;
            setIsActive(newVal);
            void onUpdate(option.id, { isActive: newVal });
          }}
        />
        
        {isDirty && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSave}
            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
            title="Save changes"
          >
            <Save className="w-4 h-4" />
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(option.id);
          }}
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
