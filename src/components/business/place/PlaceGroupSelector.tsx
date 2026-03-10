"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type VendorPlace = {
  id: string;
  title: string;
  shortAddress?: string | null;
  placeGroupId?: string | null;
};

type PlaceGroupSelectorProps = {
  currentPlaceId?: string; // undefined for new places
  ownerUserId: string;
  currentGroupId?: string | null; // Current placeGroupId
  onGroupIdChange: (groupId: string | null) => void; // Callback when group changes
  className?: string;
  disabled?: boolean;
};

export function PlaceGroupSelector({
  currentPlaceId,
  ownerUserId,
  currentGroupId,
  onGroupIdChange,
  className,
  disabled = false,
}: PlaceGroupSelectorProps) {
  const [vendorPlaces, setVendorPlaces] = useState<VendorPlace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Derive groupType from currentGroupId
  const groupType: "standalone" | "grouped" = currentGroupId ? "grouped" : "standalone";

  // Fetch vendor's other places
  useEffect(() => {
    async function fetchVendorPlaces() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({ ownerUserId });
        if (currentPlaceId) {
          params.append("excludeId", currentPlaceId);
        }
        
        const res = await fetch(`/api/business/places/list?${params}`);
        if (!res.ok) throw new Error("Failed to fetch places");
        
        const data = await res.json();
        setVendorPlaces(data.places || []);
        
        // Initialize selectedPlaceIds from currentGroupId
        if (currentGroupId) {
          const grouped = (data.places || [])
            .filter((p: VendorPlace) => p.placeGroupId === currentGroupId)
            .map((p: VendorPlace) => p.id);
          setSelectedPlaceIds(new Set(grouped));
        } else {
          setSelectedPlaceIds(new Set());
        }
      } catch (err) {
        console.error("Failed to fetch vendor places:", err);
        setError("Не удалось загрузить список мест");
      } finally {
        setIsLoading(false);
      }
    }

    fetchVendorPlaces();
  }, [ownerUserId, currentPlaceId, currentGroupId]);

  // Don't show if vendor has no other places
  if (!isLoading && vendorPlaces.length === 0) {
    return null;
  }

  const handleGroupTypeChange = async (value: string) => {
    const newType = value as "standalone" | "grouped";
    
    if (newType === "standalone") {
      setSelectedPlaceIds(new Set());
      setError(null);
      // Call API to remove from group
      if (currentPlaceId) {
        try {
          const res = await fetch(`/api/business/places/${currentPlaceId}/group`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ relatedPlaceIds: [] }),
          });
          
          if (res.ok) {
            onGroupIdChange(null);
          }
        } catch (err) {
          console.error("Failed to remove from group:", err);
        }
      } else {
        // For new places, just update parent state
        onGroupIdChange(null);
      }
    }
  };

  const handlePlaceToggle = async (placeId: string) => {
    const newSelected = new Set(selectedPlaceIds);
    
    if (newSelected.has(placeId)) {
      newSelected.delete(placeId);
    } else {
      newSelected.add(placeId);
    }
    
    setSelectedPlaceIds(newSelected);
    
    // Validate: check if selected places are from different groups
    const selectedPlaces = vendorPlaces.filter(p => newSelected.has(p.id));
    const groupIds = new Set(
      selectedPlaces
        .map(p => p.placeGroupId)
        .filter(id => id !== null)
    );
    
    if (groupIds.size > 1) {
      setError("Выбранные места принадлежат разным группам. Пожалуйста, выберите места из одной группы или без группы.");
      return;
    }
    
    setError(null);
    
    // Call API to update group
    if (currentPlaceId) {
      try {
        const res = await fetch(`/api/business/places/${currentPlaceId}/group`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ relatedPlaceIds: Array.from(newSelected) }),
        });
        
        if (res.ok) {
          const data = await res.json();
          onGroupIdChange(data.placeGroupId);
        }
      } catch (err) {
        console.error("Failed to update group:", err);
      }
    } else {
      // For new places, we need to store selected place IDs temporarily
      // We'll create the group when the place is created
      // For now, just mark that it should be grouped (we'll use a special marker)
      if (newSelected.size > 0) {
        onGroupIdChange("__pending__"); // Special marker for pending group
      } else {
        onGroupIdChange(null);
      }
    }
  };

  if (isLoading) {
    return (
      <div className={cn("rounded-lg border bg-card p-6", className)}>
        <div className="text-sm text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-card p-6 space-y-4", className)}>
      {disabled && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-sm text-amber-800">
            Изменение группы недоступно пока место находится на модерации
          </p>
        </div>
      )}
      
      <div>
        <h3 className="text-base font-semibold mb-1">
          Это отдельное место или одна из нескольких точек?
        </h3>
        <p className="text-sm text-muted-foreground">
          Если у вас несколько филиалов, вы можете объединить их в группу
        </p>
      </div>

      <RadioGroup value={groupType} onValueChange={handleGroupTypeChange} disabled={disabled}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="standalone" id="standalone" disabled={disabled} />
          <Label htmlFor="standalone" className="font-normal cursor-pointer">
            Отдельное место
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="grouped" id="grouped" disabled={disabled} />
          <Label htmlFor="grouped" className="font-normal cursor-pointer">
            Одна из нескольких точек
          </Label>
        </div>
      </RadioGroup>

      {groupType === "grouped" && (
        <div className="space-y-3 pt-2">
          <div>
            <h4 className="text-sm font-medium mb-2">Выберите связанные места</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Отметьте места, которые относятся к одной группе с текущим
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {vendorPlaces.map((place) => (
              <div
                key={place.id}
                className="flex items-start space-x-3 p-3 rounded-md border bg-background hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  id={`place-${place.id}`}
                  checked={selectedPlaceIds.has(place.id)}
                  onCheckedChange={() => handlePlaceToggle(place.id)}
                  disabled={disabled}
                />
                <Label
                  htmlFor={`place-${place.id}`}
                  className="flex-1 cursor-pointer font-normal"
                >
                  <div className="font-medium">{place.title}</div>
                  {place.shortAddress && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {place.shortAddress}
                    </div>
                  )}
                  {place.placeGroupId && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Уже в группе
                    </div>
                  )}
                </Label>
              </div>
            ))}
          </div>

          {selectedPlaceIds.size > 0 && !error && (
            <div className="text-sm text-muted-foreground">
              Выбрано мест: {selectedPlaceIds.size}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
