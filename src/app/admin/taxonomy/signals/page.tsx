"use client";

import { useEffect, useState } from "react";
import { H1, H3, Label } from "@/components/ui/typography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus, Save } from "lucide-react";

type Option = {
  id: string;
  label: string;
  value: string;
  order: number;
  isActive: boolean;
};

type Signal = {
  id: string;
  slug: string;
  title: string;
  order: number;
  isActive: boolean;
  options: Option[];
};

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New Signal Form
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");

  const fetchSignals = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/signals");
      if (res.ok) {
        const data = await res.json();
        setSignals(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, []);

  const createSignal = async () => {
    if (!newSlug || !newTitle) return;
    const res = await fetch("/api/admin/signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: newSlug, title: newTitle }),
    });
    if (res.ok) {
      setNewSlug("");
      setNewTitle("");
      fetchSignals();
    }
  };

  const updateSignal = async (id: string, data: Partial<Signal>) => {
    const res = await fetch(`/api/admin/signals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) fetchSignals();
  };

  const deleteSignal = async (id: string) => {
    if (!confirm("Delete signal?")) return;
    const res = await fetch(`/api/admin/signals/${id}`, {
      method: "DELETE",
    });
    if (res.ok) fetchSignals();
  };

  const createOption = async (signalId: string, label: string, value: string) => {
    const res = await fetch(`/api/admin/signals/${signalId}/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, value }),
    });
    if (res.ok) fetchSignals();
  };

  const updateOption = async (optionId: string, data: Partial<Option>) => {
    const res = await fetch(`/api/admin/signal-options/${optionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) fetchSignals();
  };

  const deleteOption = async (optionId: string) => {
    if (!confirm("Delete option?")) return;
    const res = await fetch(`/api/admin/signal-options/${optionId}`, {
      method: "DELETE",
    });
    if (res.ok) fetchSignals();
  };

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* AdminPageHeader */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Taxonomy: Signals</h1>
        </div>
      </div>

      {/* AdminPageContent */}
      <div className="space-y-6">

      {/* Create New Signal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Create New Signal</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 items-end">
          <div className="grid gap-2 flex-1">
            <Label>Slug</Label>
            <Input 
              value={newSlug} 
              onChange={(e) => setNewSlug(e.target.value)} 
              placeholder="e.g. atmosphere" 
            />
          </div>
          <div className="grid gap-2 flex-1">
            <Label>Title</Label>
            <Input 
              value={newTitle} 
              onChange={(e) => setNewTitle(e.target.value)} 
              placeholder="e.g. Atmosphere" 
            />
          </div>
          <Button onClick={createSignal}>
            <Plus className="w-4 h-4 mr-2" />
            Create
          </Button>
        </CardContent>
      </Card>

      {/* Signals List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : (
          signals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onUpdate={updateSignal}
              onDelete={deleteSignal}
              onCreateOption={createOption}
              onUpdateOption={updateOption}
              onDeleteOption={deleteOption}
            />
          ))
        )}
      </div>
      </div>
    </div>
  );
}

function SignalCard({ 
  signal, 
  onUpdate, 
  onDelete, 
  onCreateOption,
  onUpdateOption,
  onDeleteOption 
}: { 
  signal: Signal;
  onUpdate: (id: string, data: Partial<Signal>) => void;
  onDelete: (id: string) => void;
  onCreateOption: (id: string, label: string, value: string) => void;
  onUpdateOption: (id: string, data: Partial<Option>) => void;
  onDeleteOption: (id: string) => void;
}) {
  const [title, setTitle] = useState(signal.title);
  const [order, setOrder] = useState(signal.order);
  const [isActive, setIsActive] = useState(signal.isActive);
  
  // New Option State
  const [newOptLabel, setNewOptLabel] = useState("");
  const [newOptValue, setNewOptValue] = useState("");

  const handleSave = () => {
    onUpdate(signal.id, { title, order, isActive });
  };

  const handleAddOption = () => {
    if (!newOptLabel || !newOptValue) return;
    onCreateOption(signal.id, newOptLabel, newOptValue);
    setNewOptLabel("");
    setNewOptValue("");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold font-mono text-gray-600">
          {signal.slug}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onDelete(signal.id)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Fields */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="grid gap-2 md:col-span-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Order</Label>
            <Input 
              type="number" 
              value={order} 
              onChange={(e) => setOrder(Number(e.target.value))} 
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

        {/* Options Section */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Options</h3>
          
          <div className="space-y-2">
            {signal.options.map((opt) => (
              <OptionRow 
                key={opt.id} 
                option={opt} 
                onUpdate={onUpdateOption} 
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
