"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { SYSTEM_INTERESTS } from "@/lib/config/interests";
import { cn } from "@/lib/utils";
import { AddChildSheet } from "./AddChildSheet";
import { DatePicker } from "@/components/ui/date-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogOverlay,
} from "@/components/ui/alert-dialog";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

interface ChildData {
  id: string;
  name: string;
  birthDate: Date;
  systemInterests?: { interestSlug: string }[];
  customInterests?: { label: string }[];
}

interface AddChildModalProps {
  isOpen: boolean;
  onClose: () => void;
  childData?: ChildData; // For edit mode
}

// Custom Dialog with higher z-index
function HighZIndexDialog({ children, open, onOpenChange }: { 
  children: React.ReactNode; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <>
      {/* Custom overlay with higher z-index */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/50 animate-in fade-in-0 duration-200"
          style={{ zIndex: 9998 }}
          onClick={() => onOpenChange(false)}
        />
      )}
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
      </Dialog>
    </>
  );
}

export function AddChildModal({ isOpen, onClose, childData }: AddChildModalProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Use sheet on mobile, modal on desktop
  if (isMobile) {
    return <AddChildSheet isOpen={isOpen} onClose={onClose} childData={childData} />;
  }

  return <AddChildDesktopModal isOpen={isOpen} onClose={onClose} childData={childData} />;
}

function AddChildDesktopModal({ isOpen, onClose, childData }: AddChildModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isEditMode = !!childData;
  
  // Form state
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterests, setCustomInterests] = useState<string[]>([]);
  const [newCustomInterest, setNewCustomInterest] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Initialize form with child data in edit mode
  useEffect(() => {
    console.log("AddChildModal useEffect - isOpen:", isOpen, "childData:", childData);
    
    if (isOpen && childData) {
      console.log("Initializing form with child data:", childData);
      console.log("childData.systemInterests:", childData.systemInterests);
      console.log("childData.customInterests:", childData.customInterests);
      
      setName(childData.name);
      setBirthDate(new Date(childData.birthDate));
      
      const systemInterests = childData.systemInterests?.map(i => i.interestSlug) || [];
      const customInterests = childData.customInterests?.map(i => i.label) || [];
      
      console.log("Setting systemInterests:", systemInterests);
      console.log("Setting customInterests:", customInterests);
      
      setSelectedInterests(systemInterests);
      setCustomInterests(customInterests);
    }
  }, [isOpen, childData]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setName("");
      setBirthDate(null);
      setSelectedInterests([]);
      setCustomInterests([]);
      setNewCustomInterest("");
      setShowCustomInput(false);
      setError(null);
    }
  }, [isOpen]);

  const handleInterestToggle = (slug: string) => {
    setSelectedInterests(prev => 
      prev.includes(slug) 
        ? prev.filter(s => s !== slug)
        : [...prev, slug]
    );
  };

  const handleAddCustomInterest = () => {
    const trimmed = newCustomInterest.trim();
    if (trimmed && !customInterests.includes(trimmed)) {
      setCustomInterests(prev => [...prev, trimmed]);
      setNewCustomInterest("");
      setShowCustomInput(false);
    }
  };

  const handleRemoveCustomInterest = (interest: string) => {
    setCustomInterests(prev => prev.filter(i => i !== interest));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate edit mode has childData
      if (isEditMode && !childData) {
        throw new Error("Данные ребенка не найдены для редактирования");
      }

      // Additional logging for childData
      console.log("Edit mode:", isEditMode);
      console.log("Child data:", childData);
      console.log("Child ID:", childData?.id);

      const url = isEditMode ? `/api/children/${childData!.id}` : "/api/children";
      const method = isEditMode ? "PUT" : "POST";
      
      console.log("Constructed URL:", url);
      
      const requestData = {
        name: name.trim(),
        birthDate: birthDate?.toISOString(),
        systemInterests: selectedInterests,
        customInterests: customInterests,
      };
      
      console.log("Sending request:", { url, method, data: requestData });
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      console.log("Response status:", response.status, response.statusText);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error("Failed to parse JSON response:", jsonError);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        console.error("API Error:", data);
        
        // Handle validation errors with details
        if (data && data.details && Array.isArray(data.details)) {
          const errorMessages = data.details.map((detail: any) => detail.message).join(', ');
          throw new Error(`${data.error}: ${errorMessages}`);
        }
        
        throw new Error(data?.error || `HTTP ${response.status}: Не удалось ${isEditMode ? 'обновить' : 'добавить'} ребенка`);
      }

      // Close modal and refresh
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!childData) {
      console.error("No childData available for deletion");
      return;
    }
    
    console.log("Starting delete process for child:", childData.id);
    setIsDeleting(true);
    setError(null);

    try {
      const url = `/api/children/${childData.id}`;
      console.log("DELETE request URL:", url);
      
      const response = await fetch(url, {
        method: "DELETE",
      });

      console.log("DELETE response status:", response.status);
      console.log("DELETE response ok:", response.ok);

      if (!response.ok) {
        let data;
        try {
          data = await response.json();
          console.error("DELETE error response:", data);
        } catch (jsonError) {
          console.error("Failed to parse DELETE error response:", jsonError);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        throw new Error(data.error || "Не удалось удалить ребенка");
      }

      const result = await response.json();
      console.log("DELETE success response:", result);

      // Close modal and refresh
      console.log("Closing modal and refreshing page");
      onClose();
      router.refresh();
    } catch (err) {
      console.error("Delete error:", err);
      setError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setIsDeleting(false);
    }
  };

  const canSubmit = name.trim().length >= 2 && birthDate;

  return (
    <HighZIndexDialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl !z-[9999]" 
        style={{ zIndex: 9999 }}
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {isEditMode ? "Редактировать ребёнка" : "Добавить ребёнка"}
            </DialogTitle>
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
              disabled={isLoading || isDeleting}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Закрыть</span>
            </button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Имя ребёнка</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите имя"
              required
              minLength={2}
              className="h-11"
              autoFocus={false}
            />
          </div>

          {/* Birth Date */}
          <div className="space-y-2">
            <Label htmlFor="birthDate">Дата рождения</Label>
            <DatePicker
              value={birthDate}
              onDateChange={setBirthDate}
              disablePast={false}
              placeholder="Выберите дату рождения"
              className="w-full"
              showAge={true}
            />
          </div>

          {/* System Interests */}
          <div className="space-y-3">
            <Label>Интересы</Label>
            <div className="flex flex-wrap gap-2">
              {SYSTEM_INTERESTS.map((interest) => (
                <Badge
                  key={interest.slug}
                  variant={selectedInterests.includes(interest.slug) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-colors h-8 px-3",
                    selectedInterests.includes(interest.slug)
                      ? "bg-[#EF8759] hover:bg-[#EF8759]/90 text-white"
                      : "hover:bg-gray-100"
                  )}
                  onClick={() => handleInterestToggle(interest.slug)}
                >
                  {interest.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Custom Interests */}
          {customInterests.length > 0 && (
            <div className="space-y-2">
              <Label>Дополнительные интересы</Label>
              <div className="flex flex-wrap gap-2">
                {customInterests.map((interest) => (
                  <Badge
                    key={interest}
                    variant="secondary"
                    className="h-8 px-3 pr-1"
                  >
                    {interest}
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomInterest(interest)}
                      className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Add Custom Interest */}
          {showCustomInput ? (
            <div className="flex gap-2">
              <Input
                value={newCustomInterest}
                onChange={(e) => setNewCustomInterest(e.target.value)}
                placeholder="Например: динозавры"
                className="h-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomInterest();
                  }
                  if (e.key === "Escape") {
                    setShowCustomInput(false);
                    setNewCustomInterest("");
                  }
                }}
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddCustomInterest}
                disabled={!newCustomInterest.trim()}
              >
                Добавить
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowCustomInput(false);
                  setNewCustomInterest("");
                }}
              >
                Отмена
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCustomInput(true)}
              className="h-9"
            >
              <Plus className="h-4 w-4 mr-2" />
              Добавить свой интерес
            </Button>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="space-y-4 pt-2">
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading || isDeleting}
                className="flex-1"
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit || isLoading || isDeleting}
                className="flex-1"
              >
                {isLoading 
                  ? "Сохранение..." 
                  : isEditMode 
                    ? "Сохранить изменения" 
                    : "Сохранить"
                }
              </Button>
            </div>

            {/* Delete button - only in edit mode */}
            {isEditMode && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={isLoading || isDeleting}
                  >
                    Удалить профиль ребёнка
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogPortal>
                  {/* Semi-transparent overlay that doesn't interfere with main modal */}
                  <AlertDialogOverlay className="fixed inset-0 z-[9999] bg-black/20" />
                  <AlertDialogPrimitive.Content
                    className="fixed left-[50%] top-[50%] z-[10000] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg"
                  >
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить профиль ребёнка?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Это действие удалит имя, возраст и интересы ребёнка из семейного профиля.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>
                        Отмена
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {isDeleting ? "Удаление..." : "Удалить"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogPrimitive.Content>
                </AlertDialogPortal>
              </AlertDialog>
            )}
          </div>
        </form>
      </DialogContent>
    </HighZIndexDialog>
  );
}