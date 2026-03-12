"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/portal";
import { useRefinementFilters } from "@/contexts/RefinementFiltersContext";

interface RefinementFiltersModalProps {
  // Модал теперь управляется через контекст
}

// Mock state for filters
export interface FilterState {
  types: string[];
  isFree: boolean;
  categories: string[];
}

const MOCK_TYPES = [
  { id: "active", label: "Активно" },
  { id: "educational", label: "Познавательно" },
  { id: "calm", label: "Спокойно" },
];

const MOCK_CATEGORIES = [
  { id: "workshops", label: "Мастер-классы", width: 6 },
  { id: "shows", label: "Спектакли", width: 4 },
  { id: "exhibitions", label: "Выставки", width: 4 },
  { id: "parks", label: "Парки", width: 3 },
  { id: "cafes", label: "Кафе", width: 3 },
  { id: "playgrounds", label: "Игровые", width: 4 },
  { id: "animals", label: "Животные", width: 4 },
  { id: "interactive", label: "Интерактив", width: 5 },
  { id: "toddlers", label: "Для малышей", width: 5 },
  { id: "weekends", label: "На выходные", width: 5 },
  { id: "museums", label: "Музеи", width: 3 },
  { id: "theaters", label: "Театры", width: 3 },
];

export function RefinementFiltersModal({}: RefinementFiltersModalProps) {
  const isMobile = useIsMobile();
  const { getFilters, setFilters, isOpen, setIsOpen, currentIntent } = useRefinementFilters();
  const [isVisible, setIsVisible] = useState(false);

  // Get filters for current intent
  const filters = currentIntent ? getFilters(currentIntent) : {
    types: [],
    isFree: false,
    categories: [],
  };

  // Handle animation states
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      // Delay hiding to allow exit animation
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Block background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      
      // Apply styles to prevent scrolling
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        // Restore scroll position and remove fixed positioning
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  const handleTypeToggle = (typeId: string) => {
    if (!currentIntent) return;
    
    const newFilters = {
      ...filters,
      types: filters.types.includes(typeId)
        ? filters.types.filter(id => id !== typeId)
        : [...filters.types, typeId]
    };
    setFilters(currentIntent, newFilters);
  };

  const handleCategoryToggle = (categoryId: string) => {
    if (!currentIntent) return;
    
    const newFilters = {
      ...filters,
      categories: filters.categories.includes(categoryId)
        ? filters.categories.filter(id => id !== categoryId)
        : [...filters.categories, categoryId]
    };
    setFilters(currentIntent, newFilters);
  };

  const handleFreeToggle = (isFree: boolean) => {
    if (!currentIntent) return;
    
    const newFilters = { ...filters, isFree };
    setFilters(currentIntent, newFilters);
  };

  const handleReset = () => {
    if (!currentIntent) return;
    
    const newFilters = {
      types: [],
      isFree: false,
      categories: [],
    };
    setFilters(currentIntent, newFilters);
  };

  const handleApply = () => {
    // TODO: Apply filters logic
    console.log("Applying filters:", filters);
    setIsOpen(false);
  };

  if (!isVisible) return null;

  // Sticky header
  const stickyHeader = (
    <div className="flex items-center justify-between bg-white border-b border-gray-200 pb-6">
      <h2 className="text-lg font-semibold text-gray-900">Фильтры</h2>
      <button
        onClick={() => setIsOpen(false)}
        className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
      >
        <X className="h-5 w-5 text-gray-500" />
      </button>
    </div>
  );

  // Scrollable content
  const scrollableContent = (
    <div className="space-y-8">
      {/* Block 1 - Type */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-900">Тип</h3>
        <div className="flex flex-wrap gap-2">
          {MOCK_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => handleTypeToggle(type.id)}
              className={cn(
                "px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200",
                filters.types.includes(type.id)
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Block 2 - Free */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-900">Бесплатно</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.isFree}
            onChange={(e) => handleFreeToggle(e.target.checked)}
            className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900 focus:ring-2"
          />
          <span className="text-sm text-gray-700">Только бесплатные</span>
        </label>
      </div>

      {/* Block 3 - Categories (Masonry-like grid) */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-900">Категории</h3>
        <div className="grid grid-cols-12 gap-2 auto-rows-fr">
          {MOCK_CATEGORIES.map((category) => {
            const isActive = filters.categories.includes(category.id);
            
            return (
              <button
                key={category.id}
                onClick={() => handleCategoryToggle(category.id)}
                style={{ gridColumn: `span ${category.width}` }}
                className={cn(
                  "px-3 py-3 rounded-xl border text-sm font-medium transition-all duration-200 h-12 flex items-center justify-center hover:scale-[1.02] active:scale-[0.98]",
                  isActive
                    ? "bg-gray-900 text-white border-gray-900 shadow-lg"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 hover:shadow-md"
                )}
              >
                {category.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Sticky footer
  const stickyFooter = (
    <div className="flex items-center justify-between pt-6 border-t border-gray-200 bg-white">
      <button
        onClick={handleReset}
        className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors underline decoration-transparent hover:decoration-current underline-offset-2"
      >
        Сбросить
      </button>
      <button
        onClick={handleApply}
        className="px-8 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl"
      >
        Показать варианты
      </button>
    </div>
  );

  if (isMobile) {
    // Mobile: Bottom sheet with sticky header and footer
    return (
      <Portal>
        <div className="fixed inset-0 z-[9999] md:hidden">
          {/* Backdrop */}
          <div 
            className={cn(
              "fixed inset-0 bg-black/50 transition-opacity duration-300 ease-out",
              isOpen ? "opacity-100" : "opacity-0"
            )}
            onClick={() => setIsOpen(false)}
          />
          
          {/* Bottom Sheet */}
          <div className={cn(
            "fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-hidden transition-transform duration-300 ease-out flex flex-col",
            isOpen ? "translate-y-0" : "translate-y-full"
          )}>
            {/* Sticky Header */}
            <div className="flex-shrink-0 p-6 pb-0">
              {stickyHeader}
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 pt-6">
              {scrollableContent}
            </div>
            
            {/* Sticky Footer */}
            <div className="flex-shrink-0 px-6 pb-6">
              {stickyFooter}
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  // Desktop: Centered modal with sticky header and footer
  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] hidden md:flex items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className={cn(
            "fixed inset-0 bg-black/50 transition-opacity duration-300 ease-out",
            isOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setIsOpen(false)}
        />
        
        {/* Modal */}
        <div className={cn(
          "relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden transition-all duration-300 ease-out flex flex-col",
          isOpen 
            ? "opacity-100 scale-100 translate-y-0" 
            : "opacity-0 scale-95 translate-y-4"
        )}>
          {/* Sticky Header */}
          <div className="flex-shrink-0 p-8 pb-0">
            {stickyHeader}
          </div>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-8 pt-6">
            {scrollableContent}
          </div>
          
          {/* Sticky Footer */}
          <div className="flex-shrink-0 px-8 pb-8">
            {stickyFooter}
          </div>
        </div>
      </div>
    </Portal>
  );
}