"use client";

import { useEffect, useState } from "react";
import { H1, H3, Label } from "@/components/ui/typography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Pencil, Plus, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

type City = {
  id: string;
  name: string;
  slug: string;
};

type MetroStation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  osmType: string;
  osmId: string;
  source: string;
  createdAt: string;
};

export default function MetroStationsPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [stations, setStations] = useState<MetroStation[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>("");
  const [isLoadingCities, setIsLoadingCities] = useState(true);
  const [isLoadingStations, setIsLoadingStations] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<MetroStation | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    lat: "",
    lng: "",
    osmType: "manual",
    osmId: "manual",
  });
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

  // Fetch Stations when City changes
  useEffect(() => {
    if (!selectedCityId) return;
    fetchStations();
  }, [selectedCityId]);

  async function fetchStations() {
    setIsLoadingStations(true);
    try {
      const res = await fetch(`/api/admin/taxonomy/metro-stations?cityId=${selectedCityId}`);
      if (!res.ok) throw new Error("Failed to fetch stations");
      const data = await res.json();
      setStations(data);
    } catch (error) {
      toast.error("Не удалось загрузить станции метро");
    } finally {
      setIsLoadingStations(false);
    }
  }

  const handleOpenAdd = () => {
    setEditingStation(null);
    setFormData({
      name: "",
      lat: "",
      lng: "",
      osmType: "manual",
      osmId: crypto.randomUUID(), // Generate a unique ID for manual entries
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (station: MetroStation) => {
    setEditingStation(station);
    setFormData({
      name: station.name,
      lat: String(station.lat),
      lng: String(station.lng),
      osmType: station.osmType,
      osmId: station.osmId,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.lat || !formData.lng) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    setIsSaving(true);
    try {
      if (editingStation) {
        // Edit
        const res = await fetch(`/api/admin/taxonomy/metro-stations/${editingStation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            lat: formData.lat,
            lng: formData.lng,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          if (res.status === 409) {
            toast.error(error.error || "Такая станция уже существует");
          } else {
            throw new Error(error.error || "Failed to update");
          }
          return;
        }

        const updated = await res.json();
        setStations((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        toast.success("Станция обновлена");
      } else {
        // Create
        const res = await fetch("/api/admin/taxonomy/metro-stations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cityId: selectedCityId,
            name: formData.name,
            lat: formData.lat,
            lng: formData.lng,
            osmType: formData.osmType,
            osmId: formData.osmId,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          if (res.status === 409) {
            toast.error(error.error || "Такая станция уже существует");
          } else {
            throw new Error(error.error || "Failed to create");
          }
          return;
        }

        const created = await res.json();
        setStations((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success("Станция добавлена");
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast.error("Произошла ошибка при сохранении");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Вы уверены, что хотите удалить эту станцию?")) return;

    try {
      const res = await fetch(`/api/admin/taxonomy/metro-stations/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      setStations((prev) => prev.filter((s) => s.id !== id));
      toast.success("Станция удалена");
    } catch (error) {
      toast.error("Не удалось удалить станцию");
    }
  };

  const handleImportOSM = async () => {
    if (!selectedCityId) return;
    
    setIsImporting(true);
    try {
      const res = await fetch("/api/admin/import/metro-osm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId: selectedCityId }),
      });

      if (!res.ok) {
        let msg = `Import failed (HTTP ${res.status})`;
        try {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const body = await res.json();
            msg =
              body?.message ||
              body?.error ||
              body?.detail ||
              body?.reason ||
              msg;
            console.error("OSM import failed:", { status: res.status, body });
          } else {
            const text = await res.text();
            if (text) msg = `${msg}: ${text.slice(0, 300)}`;
            console.error("OSM import failed:", { status: res.status, text: text.slice(0, 300) });
          }
        } catch (e) {
          console.error("OSM import failed (parse error):", e);
        }
        throw new Error(msg);
      }

      const data = await res.json();
      toast.success(`Импортировано станций: ${data.imported || 0}`);
      fetchStations(); // Refresh list
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Ошибка импорта из OSM");
    } finally {
      setIsImporting(false);
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
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Metro Stations</h1>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <select 
            className="h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            value={selectedCityId}
            onChange={(e) => setSelectedCityId(e.target.value)}
          >
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
          
          <Button variant="outline" onClick={handleImportOSM} disabled={!selectedCityId || isImporting} className="h-10">
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Import from OSM
          </Button>

          <Button onClick={handleOpenAdd} disabled={!selectedCityId} className="h-10">
            <Plus className="mr-2 h-4 w-4" />
            Add Station
          </Button>
        </div>
      </div>

      {/* AdminPageContent */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-base font-semibold">Станции метро ({stations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingStations ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : stations.length === 0 ? (
            <div className="text-center text-gray-600 p-8 text-sm">Нет станций для выбранного города</div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_100px] gap-4 p-4 font-medium border-b bg-gray-50 text-sm">
                <div className="text-gray-700">Name</div>
                <div className="text-gray-700">Lat</div>
                <div className="text-gray-700">Lng</div>
                <div className="text-gray-700">Source</div>
                <div className="text-right text-gray-700">Actions</div>
              </div>
              <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                {stations.map((station) => (
                  <div key={station.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_100px] gap-4 p-4 items-center hover:bg-gray-50 transition-colors text-sm">
                    <div className="font-medium text-gray-900">{station.name}</div>
                    <div className="font-mono text-gray-600">{station.lat.toFixed(6)}</div>
                    <div className="font-mono text-gray-600">{station.lng.toFixed(6)}</div>
                    <div className="text-xs">
                      <span className={`px-2 py-1 rounded-full ${station.source === 'OSM' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                        {station.source}
                      </span>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(station)}>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(station.id)}>
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
            <DialogTitle>{editingStation ? "Редактировать станцию" : "Добавить станцию"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Название</Label>
              <Input 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Например: Площадь Ленина"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Latitude</Label>
                <Input 
                  type="number"
                  step="any"
                  value={formData.lat} 
                  onChange={(e) => setFormData({...formData, lat: e.target.value})}
                  placeholder="53.89..."
                />
              </div>
              <div className="grid gap-2">
                <Label>Longitude</Label>
                <Input 
                  type="number"
                  step="any"
                  value={formData.lng} 
                  onChange={(e) => setFormData({...formData, lng: e.target.value})}
                  placeholder="27.55..."
                />
              </div>
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
