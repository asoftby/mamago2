"use client";

import { useEffect, useState } from "react";
import { H1, H3, Label } from "@/components/ui/typography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Save, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterOptionRow } from "./FilterOptionRow";

type Option = {
  id: string;
  label: string;
  value: string;
  order: number;
  orderIndex: number;
  isActive: boolean;
};

type Filter = {
  id: string;
  slug: string;
  title: string;
  type: string;
  ui: string;
  order: number;
  orderIndex: number;
  placement: "PRIMARY" | "SECONDARY" | "HIDDEN";
  isActive: boolean;
  options: Option[];
};

export default function FiltersPage() {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New Filter Form
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("single");
  const [newUi, setNewUi] = useState("tabs");

  const fetchFilters = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/filters");
      if (res.ok) {
        const data = await res.json();
        setFilters(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  const createFilter = async () => {
    if (!newSlug || !newTitle) return;
    const res = await fetch("/api/admin/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: newSlug, title: newTitle, type: newType, ui: newUi }),
    });
    if (res.ok) {
      setNewSlug("");
      setNewTitle("");
      setNewType("single");
      setNewUi("tabs");
      fetchFilters();
    }
  };

  const updateFilter = async (id: string, data: Partial<Filter>) => {
    const res = await fetch(`/api/admin/filters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Updated");
      fetchFilters();
    } else {
      toast.error("Failed to update");
    }
  };

  const deleteFilter = async (id: string) => {
    if (!confirm("Delete filter?")) return;
    const res = await fetch(`/api/admin/filters/${id}`, {
      method: "DELETE",
    });
    if (res.ok) fetchFilters();
  };

  const createOption = async (filterId: string, label: string, value: string) => {
    const res = await fetch(`/api/admin/filters/${filterId}/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, value }),
    });
    if (res.ok) fetchFilters();
  };

  const updateOption = async (optionId: string, data: Partial<Option>) => {
    const res = await fetch(`/api/admin/filter-options/${optionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) fetchFilters();
  };

  const reorderOption = async (optionId: string, direction: "UP" | "DOWN") => {
    const res = await fetch("/api/admin/filters/options/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId, direction }),
    });
    if (res.ok) {
      fetchFilters();
    } else {
      toast.error("Option reorder failed");
    }
  };

  const deleteOption = async (optionId: string) => {
    if (!confirm("Delete option?")) return;
    const res = await fetch(`/api/admin/filter-options/${optionId}`, {
      method: "DELETE",
    });
    if (res.ok) fetchFilters();
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <H1>Discovery: Filters</H1>
      </div>

      {/* Create New Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="grid gap-2 min-w-[150px] flex-1">
            <Label>Slug</Label>
            <Input 
              value={newSlug} 
              onChange={(e) => setNewSlug(e.target.value)} 
              placeholder="e.g. metro" 
            />
          </div>
          <div className="grid gap-2 min-w-[150px] flex-1">
            <Label>Title</Label>
            <Input 
              value={newTitle} 
              onChange={(e) => setNewTitle(e.target.value)} 
              placeholder="e.g. Метро" 
            />
          </div>
          <div className="grid gap-2 w-[120px]">
            <Label>Type</Label>
            <Input 
              value={newType} 
              onChange={(e) => setNewType(e.target.value)} 
              placeholder="single/multi" 
            />
          </div>
          <div className="grid gap-2 w-[120px]">
            <Label>UI</Label>
            <Input 
              value={newUi} 
              onChange={(e) => setNewUi(e.target.value)} 
              placeholder="tabs/dropdown" 
            />
          </div>
          <Button onClick={createFilter}>
            <Plus className="w-4 h-4 mr-2" />
            Create
          </Button>
        </CardContent>
      </Card>

      {/* Filters List */}
      <div className="grid gap-6">
        {loading ? (
          <div>Loading...</div>
        ) : (
          filters
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((filter, index) => (
            <FilterCard
              key={filter.id}
              filter={filter}
              onUpdate={updateFilter}
              onDelete={deleteFilter}
              onCreateOption={createOption}
              onUpdateOption={updateOption}
              onReorderOption={reorderOption}
              onDeleteOption={deleteOption}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FilterCard({ 
  filter, 
  onUpdate, 
  onDelete, 
  onCreateOption,
  onUpdateOption,
  onReorderOption,
  onDeleteOption 
}: { 
  filter: Filter;
  onUpdate: (id: string, data: Partial<Filter>) => void;
  onDelete: (id: string) => void;
  onCreateOption: (id: string, label: string, value: string) => void;
  onUpdateOption: (id: string, data: Partial<Option>) => void;
  onReorderOption: (optionId: string, direction: "UP" | "DOWN") => void;
  onDeleteOption: (id: string) => void;
}) {
  const [title, setTitle] = useState(filter.title);
  const [type, setType] = useState(filter.type);
  const [ui, setUi] = useState(filter.ui);
  const [orderIndex, setOrderIndex] = useState(filter.orderIndex);
  const [isActive, setIsActive] = useState(filter.isActive);
  const [placement, setPlacement] = useState<"PRIMARY" | "SECONDARY" | "HIDDEN">(filter.placement || "PRIMARY");
  
  // New Option State
  const [newOptLabel, setNewOptLabel] = useState("");
  const [newOptValue, setNewOptValue] = useState("");

  const handleSave = () => {
    onUpdate(filter.id, { title, type, ui, isActive, placement, orderIndex });
  };

  const handleAddOption = () => {
    if (!newOptLabel || !newOptValue) return;
    onCreateOption(filter.id, newOptLabel, newOptValue);
    setNewOptLabel("");
    setNewOptValue("");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <CardTitle className="text-xl font-bold font-mono text-muted-foreground">
            {filter.slug}
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onDelete(filter.id)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Fields */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div className="grid gap-2 md:col-span-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Input value={type} onChange={(e) => setType(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>UI</Label>
            <Input value={ui} onChange={(e) => setUi(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Placement</Label>
            <Select value={placement} onValueChange={(val: any) => setPlacement(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRIMARY">Primary</SelectItem>
                <SelectItem value="SECONDARY">Secondary</SelectItem>
                <SelectItem value="HIDDEN">Hidden</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 w-20">
            <Label>Order</Label>
            <Input 
              type="number"
              value={orderIndex} 
              onChange={(e) => setOrderIndex(Number(e.target.value))} 
            />
          </div>
          <div className="flex items-center gap-4 pb-2">
            <div className="flex items-center gap-2">
              <Checkbox 
                checked={isActive} 
                onCheckedChange={(c) => setIsActive(!!c)} 
              />
              <Label>Active</Label>
            </div>
            <Button size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>

        {/* Options List */}
        <div className="space-y-4 pt-4 border-t">
          <H3>Options</H3>
          <div className="space-y-2">
            {filter.options
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((opt, index) => (
                <FilterOptionRow
                  key={opt.id}
                  option={opt}
                  index={index}
                  totalOptions={filter.options.length}
                  onUpdate={onUpdateOption}
                  onReorder={onReorderOption}
                  onDelete={onDeleteOption}
                />
              ))}
          </div>

          {/* Add Option */}
          <div className="flex gap-2 items-end pt-2 border-t">
            <div className="grid gap-1 flex-1">
              <Label className="text-xs">Label</Label>
              <Input 
                value={newOptLabel} 
                onChange={(e) => setNewOptLabel(e.target.value)} 
                placeholder="Label" 
                className="h-8 text-sm"
              />
            </div>
            <div className="grid gap-1 flex-1">
              <Label className="text-xs">Value</Label>
              <Input 
                value={newOptValue} 
                onChange={(e) => setNewOptValue(e.target.value)} 
                placeholder="value" 
                className="h-8 text-sm"
              />
            </div>
            <Button size="sm" variant="secondary" onClick={handleAddOption}>
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OptionRow({ 
  option, 
  onUpdate, 
  onDelete 
}: { 
  option: Option;
  onUpdate: (id: string, data: Partial<Option>) => void;
  onDelete: (id: string) => void;
}) {
  const [label, setLabel] = useState(option.label);
  const [value, setValue] = useState(option.value);
  const [order, setOrder] = useState(option.order);
  const [isActive, setIsActive] = useState(option.isActive);

  const hasChanges = 
    label !== option.label || 
    value !== option.value || 
    order !== option.order || 
    isActive !== option.isActive;

  const handleSave = () => {
    onUpdate(option.id, { label, value, order, isActive });
  };

  return (
    <div className="flex items-center gap-2 bg-background p-2 rounded border">
      <Input 
        value={label} 
        onChange={(e) => setLabel(e.target.value)} 
        className="h-8 text-sm flex-[2]" 
      />
      <Input 
        value={value} 
        onChange={(e) => setValue(e.target.value)} 
        className="h-8 text-sm font-mono flex-[2]" 
      />
      <Input 
        type="number" 
        value={order} 
        onChange={(e) => setOrder(Number(e.target.value))} 
        className="h-8 text-sm w-16" 
      />
      <Checkbox 
        checked={isActive} 
        onCheckedChange={(c) => setIsActive(!!c)} 
      />
      {hasChanges && (
        <Button size="icon-xs" onClick={handleSave}>
          <Save className="w-3 h-3" />
        </Button>
      )}
      <Button size="icon-xs" variant="ghost" onClick={() => onDelete(option.id)}>
        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
}
