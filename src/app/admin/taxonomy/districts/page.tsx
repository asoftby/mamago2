"use client";

import { useEffect, useState } from "react";
import { H1, H3, Label } from "@/components/ui/typography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Pencil, Plus, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { FilterSelect } from "@/components/ui/filter-select";

type City = {
  id: string;
  name: string;
  slug: string;
};

type District = {
  id: string;
  name: string;
  createdAt: string;
};

export default function DistrictsPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>("");
  const [isLoadingCities, setIsLoadingCities] = useState(true);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
  const [districtName, setDistrictName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Fetch Cities
  useEffect(() => {
    async function fetchCities() {
      try {
        const res = await fetch("/api/admin/taxonomy/cities");
        if (!res.ok) throw new Error("Failed to fetch cities");
        const data = await res.json();
        setCities(data);
        if (data.length > 0) {
          setSelectedCityId(data[0].id);
        }
      } catch (error) {
        toast.error("Не удалось загрузить список городов");
      } finally {
        setIsLoadingCities(false);
      }
    }
    fetchCities();
  }, []);

  // Fetch Districts when City changes
  useEffect(() => {
    if (!selectedCityId) return;
    
    async function fetchDistricts() {
      setIsLoadingDistricts(true);
      try {
        const res = await fetch(`/api/admin/taxonomy/districts?cityId=${selectedCityId}`);
        if (!res.ok) throw new Error("Failed to fetch districts");
        const data = await res.json();
        setDistricts(data);
      } catch (error) {
        toast.error("Не удалось загрузить районы");
      } finally {
        setIsLoadingDistricts(false);
      }
    }
    fetchDistricts();
  }, [selectedCityId]);

  const handleOpenAdd = () => {
    setEditingDistrict(null);
    setDistrictName("");
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (district: District) => {
    setEditingDistrict(district);
    setDistrictName(district.name);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!districtName.trim() || districtName.trim().length < 2) {
      toast.error("Название должно быть не менее 2 символов");
      return;
    }

    setIsSaving(true);
    try {
      if (editingDistrict) {
        // Edit
        const res = await fetch(`/api/admin/taxonomy/districts/${editingDistrict.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: districtName }),
        });

        if (!res.ok) {
          const error = await res.json();
          if (res.status === 409) {
            toast.error(error.error || "Такой район уже существует");
          } else {
            throw new Error(error.error || "Failed to update");
          }
          return;
        }

        const updated = await res.json();
        setDistricts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        toast.success("Район обновлен");
      } else {
        // Create
        const res = await fetch("/api/admin/taxonomy/districts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cityId: selectedCityId, name: districtName }),
        });

        if (!res.ok) {
          const error = await res.json();
          if (res.status === 409) {
            toast.error(error.error || "Такой район уже существует");
          } else {
            throw new Error(error.error || "Failed to create");
          }
          return;
        }

        const created = await res.json();
        setDistricts((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success("Район добавлен");
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast.error("Произошла ошибка при сохранении");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот район?")) return;

    try {
      const res = await fetch(`/api/admin/taxonomy/districts/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      setDistricts((prev) => prev.filter((d) => d.id !== id));
      toast.success("Район удален");
    } catch (error) {
      toast.error("Не удалось удалить район");
    }
  };

  if (isLoadingCities) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* AdminPageHeader */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Districts</h1>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="min-w-[200px]">
            <FilterSelect
              value={selectedCityId}
              options={cities.map((city) => ({ value: city.id, label: city.name }))}
              onChange={setSelectedCityId}
              className="md:w-auto"
            />
          </div>
          <Button onClick={handleOpenAdd} disabled={!selectedCityId} className="h-10">
            <Plus className="mr-2 h-4 w-4" />
            Add District
          </Button>
        </div>
      </div>

      {/* AdminPageContent */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-base font-semibold">Районы ({districts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingDistricts ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : districts.length === 0 ? (
            <div className="text-center text-gray-600 p-8 text-sm">Нет районов для выбранного города</div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_100px] gap-4 p-4 font-medium border-b bg-gray-50 text-sm">
                <div className="text-gray-700">Name</div>
                <div className="text-right text-gray-700">Actions</div>
              </div>
              <div className="divide-y divide-gray-200">
                {districts.map((district) => (
                  <div key={district.id} className="grid grid-cols-[1fr_100px] gap-4 p-4 items-center hover:bg-gray-50 transition-colors text-sm">
                    <div className="font-medium text-gray-900">{district.name}</div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(district)}>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(district.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDistrict ? "Редактировать район" : "Добавить район"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Название</Label>
              <Input 
                value={districtName} 
                onChange={(e) => setDistrictName(e.target.value)}
                placeholder="Например: Центральный"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
